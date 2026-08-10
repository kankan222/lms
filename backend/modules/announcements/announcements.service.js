import AppError from "../../core/errors/AppError.js";
import { inflateRawSync } from "node:zlib";
import * as notificationService from "../notifications/notification.service.js";
import * as repo from "./announcements.repository.js";

const DELIVERY_MODES = new Set(["online", "offline_sms", "both"]);
const STATUSES = new Set(["draft", "scheduled"]);
const PRIORITIES = new Set(["normal", "urgent"]);
const MESSAGE_TYPES = new Set(["custom", "registered_dlt"]);
const TARGET_TYPES = new Set(["all", "role", "user", "parents", "teachers", "staff", "accounts", "class", "section", "scope"]);
const TEMPLATE_STATUSES = new Set(["registered", "inactive", "pending", "rejected"]);
const PLACEHOLDER_STYLES = new Set(["var", "alp", "mixed"]);
const PLACEHOLDER_TYPES = new Set(["text", "date", "holiday", "number"]);
const HOLIDAY_CATEGORY_SLUGS = new Set(["holiday", "festival", "vacation"]);
const FAST2SMS_DLT_URL = "https://www.fast2sms.com/dev/bulkV2";

function requiredString(value, field) {
  const text = String(value || "").trim();
  if (!text) throw new AppError(`${field} is required`, 400);
  return text;
}

function optionalString(value) {
  const text = String(value || "").trim();
  return text || null;
}

function optionalTemplateString(value) {
  const text = String(value || "").trim();
  return text && text !== "-" ? text : null;
}

function intValue(value, field, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new AppError(`${field} is required`, 400);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new AppError(`${field} must be a valid id`, 400);
  return parsed;
}

function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback ? 1 : 0;
  return Boolean(value) ? 1 : 0;
}

function dateValue(value, field, required = false) {
  const text = String(value || "").trim();
  if (!text) {
    if (required) throw new AppError(`${field} is required`, 400);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new AppError(`${field} must be YYYY-MM-DD`, 400);
  return text;
}

function templateDateValue(value) {
  const text = String(value || "").trim();
  if (!text || text === "-") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  return dateValue(text, "registered_on");
}

function dateTimeValue(value, field) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new AppError(`${field} must be a valid date/time`, 400);
  return text.length === 10 ? `${text} 00:00:00` : text;
}

function parseJsonValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizePlaceholderSchema(input = []) {
  const rows = Array.isArray(input) ? input : parseJsonValue(input, []);
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows
    .map((row, index) => {
      const key = optionalString(row.key) || `value_${index + 1}`;
      const normalizedKey = key
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || `value_${index + 1}`;
      const type = String(row.type || "text").trim().toLowerCase();
      if (!PLACEHOLDER_TYPES.has(type)) {
        throw new AppError(`Invalid placeholder type: ${type}`, 400);
      }
      if (seen.has(normalizedKey)) {
        throw new AppError(`Duplicate placeholder key: ${normalizedKey}`, 400);
      }
      seen.add(normalizedKey);
      return {
        key: normalizedKey,
        label: optionalString(row.label) || `Value ${index + 1}`,
        type,
        required: row.required === undefined ? true : Boolean(row.required),
      };
    });
}

function placeholderSchemaForTemplate(template = {}) {
  const schema = normalizePlaceholderSchema(template.placeholder_schema_json || template.placeholder_schema || []);
  const count = countTemplatePlaceholders(template);
  if (schema.length) return schema;
  return Array.from({ length: count }, (_, index) => ({
    key: `value_${index + 1}`,
    label: `Value ${index + 1}`,
    type: "text",
    required: true,
  }));
}

function renderTemplateContent(templateContent = "", values = []) {
  let index = 0;
  return String(templateContent || "").replace(/\{#(?:var|alp)#\}/gi, () => String(values[index++] ?? ""));
}

function normalizeSmsVariablesForTemplate(template, input = {}) {
  const schema = placeholderSchemaForTemplate(template);
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const values = [];
  const normalized = { order: schema.map((item) => item.key) };
  for (const item of schema) {
    const raw = source[item.key] ?? "";
    const value = String(raw ?? "").trim();
    if (item.required && !value) throw new AppError(`${item.label} is required for the selected DLT template`, 400);
    if (value && item.type === "date") normalized[item.key] = dateValue(value, item.label, true);
    else normalized[item.key] = value;
    values.push(normalized[item.key] || "");
  }
  return {
    variables: normalized,
    renderedBody: renderTemplateContent(template.template_content, values),
  };
}

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function allowNonProductionSms() {
  return String(process.env.SMS_ALLOW_NON_PRODUCTION || "").trim().toLowerCase() === "true";
}

function requireConfig(name) {
  const value = process.env[name];
  if (!value) throw new AppError(`${name} is not configured`, 500);
  return value;
}

function optionalConfig(name) {
  const value = process.env[name];
  return value ? String(value).trim() : "";
}

export function assertSmsDeliveryWebhookSecret({ headers = {}, query = {} } = {}) {
  const expected = optionalConfig("FAST2SMS_WEBHOOK_SECRET") || optionalConfig("SMS_WEBHOOK_SECRET");
  if (!expected) return;
  const received = headers["x-webhook-secret"] || headers["x-fast2sms-secret"] || query.secret || query.token;
  if (String(received || "") !== expected) throw new AppError("Invalid SMS delivery webhook secret", 401);
}

function normalizeCategorySlug(name) {
  return requiredString(name, "slug")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTargets(input = []) {
  const targets = Array.isArray(input) && input.length ? input : [{ target_type: "all" }];
  return targets.map((target) => {
    const targetType = String(target.target_type || target.type || "").trim();
    if (!TARGET_TYPES.has(targetType)) throw new AppError(`Invalid target type: ${targetType}`, 400);
    if (targetType === "role" && !optionalString(target.role_name)) {
      throw new AppError("role_name is required for role targets", 400);
    }
    if (targetType === "user" && !intValue(target.user_id, "target.user_id")) {
      throw new AppError("user_id is required for user targets", 400);
    }
    return {
      target_type: targetType,
      role_name: optionalString(target.role_name),
      user_id: intValue(target.user_id, "target.user_id"),
      session_id: intValue(target.session_id, "target.session_id"),
      scope_code: optionalString(target.scope_code),
      class_id: intValue(target.class_id, "target.class_id"),
      section_id: intValue(target.section_id, "target.section_id"),
      medium: optionalString(target.medium),
      stream_id: intValue(target.stream_id, "target.stream_id"),
      include_inactive: Boolean(target.include_inactive),
    };
  });
}

function normalizeAttachments(input = []) {
  if (!Array.isArray(input)) return [];
  return input.map((attachment) => ({
    file_name: requiredString(attachment.file_name || attachment.name, "attachment.file_name"),
    file_url: requiredString(attachment.file_url || attachment.url, "attachment.file_url"),
    mime_type: optionalString(attachment.mime_type),
    file_size: Number(attachment.file_size) || null,
  }));
}

async function normalizeAnnouncementPayload(body = {}, userId) {
  const messageType = String(body.message_type || (body.sms_template_id ? "registered_dlt" : "custom")).trim();
  if (!MESSAGE_TYPES.has(messageType)) throw new AppError(`Invalid message_type: ${messageType}`, 400);
  const deliveryMode = String(body.delivery_mode || "online").trim();
  if (!DELIVERY_MODES.has(deliveryMode)) throw new AppError(`Invalid delivery_mode: ${deliveryMode}`, 400);
  if (messageType === "custom" && deliveryMode !== "online") {
    throw new AppError("Custom announcements can only use online delivery. Select a registered DLT template for SMS.", 400);
  }
  const status = String(body.status || (body.publish_at ? "scheduled" : "draft")).trim();
  if (!STATUSES.has(status)) throw new AppError("Announcement can only be saved as draft or scheduled", 400);
  const publishAt = dateTimeValue(body.publish_at, "publish_at");
  if (status === "scheduled" && !publishAt) throw new AppError("publish_at is required for scheduled announcements", 400);
  const priority = String(body.priority || "normal").trim();
  if (!PRIORITIES.has(priority)) throw new AppError(`Invalid priority: ${priority}`, 400);
  const eventStart = dateValue(body.event_start_date, "event_start_date");
  const eventEnd = dateValue(body.event_end_date, "event_end_date");
  if (eventStart && eventEnd && eventStart > eventEnd) {
    throw new AppError("event_start_date must be before event_end_date", 400);
  }
  const smsTemplateId = intValue(body.sms_template_id, "sms_template_id");
  let smsVariables = {};
  let normalizedBody = messageType === "registered_dlt" ? optionalString(body.body) || "" : requiredString(body.body, "body");
  if (["offline_sms", "both"].includes(deliveryMode) && !smsTemplateId) {
    throw new AppError("sms_template_id is required for offline announcements", 400);
  }
  if (messageType === "registered_dlt") {
    if (!smsTemplateId) throw new AppError("sms_template_id is required for registered DLT announcements", 400);
    const template = await repo.getSmsTemplateById(smsTemplateId);
    if (!template) throw new AppError("SMS template not found", 404);
    if (template.status !== "registered") throw new AppError("Only registered DLT templates can be used for announcements", 400);
    const normalized = normalizeSmsVariablesForTemplate(template, body.sms_variables || {});
    smsVariables = normalized.variables;
    normalizedBody = normalized.renderedBody || normalizedBody;
  }
  if (!normalizedBody) throw new AppError("body is required", 400);
  return {
    message_type: messageType,
    category_id: intValue(body.category_id, "category_id"),
    title: requiredString(body.title, "title"),
    body: normalizedBody,
    delivery_mode: deliveryMode,
    status,
    priority,
    publish_at: publishAt,
    expires_at: dateTimeValue(body.expires_at, "expires_at"),
    event_start_date: eventStart,
    event_end_date: eventEnd,
    reopen_date: dateValue(body.reopen_date, "reopen_date"),
    show_in_software: boolValue(body.show_in_software, true),
    show_in_mobile: boolValue(body.show_in_mobile, true),
    show_on_website: boolValue(body.show_on_website, false),
    create_notification: boolValue(body.create_notification, true),
    send_push: boolValue(body.send_push, true),
    sms_template_id: smsTemplateId,
    sms_variables: smsVariables,
    sms_send_at: dateTimeValue(body.sms_send_at, "sms_send_at"),
    user_id: userId,
  };
}

export function listCategories() {
  return repo.listCategories();
}

export async function createCategory(body, userId) {
  const name = requiredString(body.name, "name");
  return repo.createCategory({
    name,
    slug: body.slug ? normalizeCategorySlug(body.slug) : normalizeCategorySlug(name),
    description: optionalString(body.description),
    user_id: userId,
  });
}

function normalizeSmsTemplate(body = {}, userId) {
  const status = String(body.status || "registered").trim().toLowerCase();
  if (!TEMPLATE_STATUSES.has(status)) throw new AppError(`Invalid template status: ${status}`, 400);
  const placeholderStyle = String(body.placeholder_style || "alp").trim().toLowerCase();
  if (!PLACEHOLDER_STYLES.has(placeholderStyle)) throw new AppError(`Invalid placeholder_style: ${placeholderStyle}`, 400);
  const templateContent = requiredString(body.template_content, "template_content");
  const placeholderMatches = templateContent.match(/\{#(?:var|alp)#\}/gi) || [];
  const explicitPlaceholderCount = String(body.placeholder_count ?? "").trim();
  const placeholderSchema = normalizePlaceholderSchema(body.placeholder_schema || body.placeholder_schema_json || []);
  if (placeholderSchema.length && placeholderSchema.length !== placeholderMatches.length) {
    throw new AppError("Placeholder schema count must match the DLT template variables", 400);
  }
  return {
    template_name: requiredString(body.template_name, "template_name"),
    dlt_template_id: requiredString(body.dlt_template_id, "dlt_template_id"),
    header: requiredString(body.header, "header"),
    communication_type: optionalTemplateString(body.communication_type),
    template_content: templateContent,
    brand_dlt_id: optionalTemplateString(body.brand_dlt_id),
    placeholder_style: placeholderStyle,
    placeholder_count: explicitPlaceholderCount !== "" && Number.isInteger(Number(explicitPlaceholderCount))
      ? Number(explicitPlaceholderCount)
      : placeholderMatches.length,
    placeholder_schema: placeholderSchema,
    status,
    provider: optionalTemplateString(body.provider) || "fast2sms",
    creator: optionalTemplateString(body.creator),
    registered_on: templateDateValue(body.registered_on),
    user_id: userId,
  };
}

export function listSmsTemplates(filters) {
  return repo.listSmsTemplates(filters);
}

export async function createSmsTemplate(body, userId) {
  return repo.createSmsTemplate(normalizeSmsTemplate(body, userId));
}

export async function updateSmsTemplate(id, body, userId) {
  const template = await repo.updateSmsTemplate(intValue(id, "template id", true), normalizeSmsTemplate(body, userId));
  if (!template) throw new AppError("SMS template not found", 404);
  return template;
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pick(row, names) {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function parseCsvTemplates(text, userId) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new AppError("CSV must include a header row and at least one template row", 400);

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] || ""]));
    const template = normalizeSmsTemplate({
      template_name: pick(row, ["template_name", "name", "template", "template_title"]),
      dlt_template_id: pick(row, ["dlt_template_id", "template_dlt_id", "template_id", "dlt_id", "entity_template_id"]),
      header: pick(row, ["header", "sender_id", "sender", "principal_entity_header"]),
      communication_type: pick(row, ["communication_type", "type", "category"]),
      template_content: pick(row, ["template_content", "content", "message", "template_message", "text"]),
      brand_dlt_id: pick(row, ["brand_dlt_id", "entity_id", "pe_id", "principal_entity_id"]),
      placeholder_style: pick(row, ["placeholder_style"]) || "alp",
      placeholder_count: pick(row, ["placeholder_count", "variables", "variable_count"]) || 0,
      status: pick(row, ["status", "template_status"]) || "registered",
      provider: pick(row, ["provider"]) || "fast2sms",
      creator: pick(row, ["creator", "template_creator", "created_by"]),
      registered_on: pick(row, ["registered_on", "template_created_on", "registration_date", "date"]),
    }, userId);
    return { ...template, row_number: index + 2 };
  });
}

function decodeXml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function columnIndex(cellRef = "") {
  const letters = String(cellRef).match(/^[A-Z]+/i)?.[0] || "";
  return letters
    .toUpperCase()
    .split("")
    .reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function readZipEntries(buffer) {
  const entries = new Map();
  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) throw new AppError("Invalid XLSX file", 400);

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    const data = compressionMethod === 0
      ? compressed
      : compressionMethod === 8
        ? inflateRawSync(compressed)
        : null;
    if (data) entries.set(fileName, data);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readSharedStrings(entries) {
  const xml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!xml) return [];
  return [...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    const textParts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]));
    return textParts.join("");
  });
}

function readFirstWorksheet(entries) {
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8") || "";
  const rels = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") || "";
  const firstSheetRelId = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  if (firstSheetRelId) {
    const relMatch = rels.match(new RegExp(`<Relationship[^>]*Id="${firstSheetRelId}"[^>]*Target="([^"]+)"`));
    const target = relMatch?.[1];
    if (target) {
      const normalized = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\.\//, "")}`;
      const sheet = entries.get(normalized);
      if (sheet) return sheet.toString("utf8");
    }
  }
  const fallback = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  return fallback ? entries.get(fallback).toString("utf8") : "";
}

function readCellValue(cellXml, sharedStrings) {
  const type = cellXml.match(/\bt="([^"]+)"/)?.[1] || "";
  if (type === "inlineStr") {
    return decodeXml([...cellXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join(""));
  }
  const value = decodeXml(cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] || "");
  if (type === "s") return sharedStrings[Number(value)] || "";
  return value;
}

function parseXlsxRows(buffer) {
  const entries = readZipEntries(buffer);
  const sharedStrings = readSharedStrings(entries);
  const sheetXml = readFirstWorksheet(entries);
  if (!sheetXml) throw new AppError("XLSX worksheet not found", 400);

  return [...sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)]
    .map((rowMatch) => {
      const row = [];
      for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const ref = cellMatch[1].match(/\br="([^"]+)"/)?.[1] || "";
        const index = Math.max(0, columnIndex(ref));
        row[index] = readCellValue(cellMatch[0], sharedStrings).trim();
      }
      return row;
    })
    .filter((row) => row.some((cell) => String(cell || "").trim()));
}

function parseXlsxTemplates(buffer, userId) {
  const rows = parseXlsxRows(buffer);
  if (rows.length < 2) throw new AppError("XLSX must include a header row and at least one template row", 400);
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cells, index) => {
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] || ""]));
    const template = normalizeSmsTemplate({
      template_name: pick(row, ["template_name", "name", "template", "template_title"]),
      dlt_template_id: pick(row, ["dlt_template_id", "template_dlt_id", "template_id", "dlt_id", "entity_template_id"]),
      header: pick(row, ["header", "sender_id", "sender", "principal_entity_header"]),
      communication_type: pick(row, ["communication_type", "type", "category"]),
      template_content: pick(row, ["template_content", "content", "message", "template_message", "text"]),
      brand_dlt_id: pick(row, ["brand_dlt_id", "entity_id", "pe_id", "principal_entity_id"]),
      placeholder_style: pick(row, ["placeholder_style"]) || "alp",
      placeholder_count: pick(row, ["placeholder_count", "variables", "variable_count"]) || 0,
      status: pick(row, ["status", "template_status"]) || "registered",
      provider: pick(row, ["provider"]) || "fast2sms",
      creator: pick(row, ["creator", "template_creator", "created_by"]),
      registered_on: pick(row, ["registered_on", "template_created_on", "registration_date", "date"]),
    }, userId);
    return { ...template, row_number: index + 2 };
  });
}

export async function importSmsTemplates(file, userId) {
  if (!file?.buffer) throw new AppError("CSV file is required", 400);
  const name = String(file.originalname || "").toLowerCase();
  const isCsv = name.endsWith(".csv") || String(file.mimetype || "").includes("csv");
  const isXlsx = name.endsWith(".xlsx") || String(file.mimetype || "").includes("spreadsheetml");
  if (!isCsv && !isXlsx) {
    throw new AppError("Upload a CSV or XLSX export of the DLT template sheet", 400);
  }
  const templates = isXlsx
    ? parseXlsxTemplates(file.buffer, userId)
    : parseCsvTemplates(file.buffer.toString("utf8"), userId);
  const imported = [];
  const errors = [];
  for (const template of templates) {
    try {
      imported.push(await repo.upsertSmsTemplate(template));
    } catch (err) {
      errors.push({ row: template.row_number, message: err.message || "Import failed" });
    }
  }
  return {
    imported_count: imported.filter(Boolean).length,
    failed_count: errors.length,
    errors,
  };
}

export function listAnnouncements(filters = {}, actor = {}) {
  const canManage = actor.permissions?.includes("announcements.manage") || actor.permissions?.includes("announcements.publish");
  return repo.listAnnouncements({
    ...filters,
    published_only: !canManage || filters.published_only,
  });
}

export async function getAnnouncement(id) {
  const announcement = await repo.getAnnouncementById(intValue(id, "announcement id", true));
  if (!announcement) throw new AppError("Announcement not found", 404);
  return announcement;
}

export function listMobileAnnouncements(filters = {}, userId) {
  return repo.listMobileAnnouncementsForUser(userId, filters);
}

export async function getMobileAnnouncement(id, userId) {
  const announcement = await repo.getMobileAnnouncementForUser(intValue(id, "announcement id", true), userId);
  if (!announcement) throw new AppError("Announcement not found", 404);
  return announcement;
}

export async function createAnnouncement(body, userId) {
  const data = await normalizeAnnouncementPayload(body, userId);
  const targets = normalizeTargets(body.targets);
  const attachments = normalizeAttachments(body.attachments);
  return repo.createAnnouncement(data, targets, attachments);
}

export async function updateAnnouncement(id, body, userId) {
  const announcementId = intValue(id, "announcement id", true);
  const before = await repo.getAnnouncementById(announcementId);
  if (!before) throw new AppError("Announcement not found", 404);
  const data = await normalizeAnnouncementPayload(body, userId);
  const targets = normalizeTargets(body.targets);
  const attachments = normalizeAttachments(body.attachments);
  if (["published", "sent"].includes(before.status)) {
    return repo.createDraftVersionFromAnnouncement(before, { ...data, status: data.status || "draft" }, targets, attachments);
  }
  if (!["draft", "scheduled"].includes(before.status)) {
    throw new AppError("Only draft, scheduled, published, or sent announcements can be edited", 400);
  }
  const announcement = await repo.updateAnnouncement(announcementId, data, targets, attachments);
  if (!announcement) throw new AppError("Announcement could not be updated", 400);
  return announcement;
}

export async function publishAnnouncement(id, userId) {
  const announcementId = intValue(id, "announcement id", true);
  const before = await repo.getAnnouncementById(announcementId);
  if (!before) throw new AppError("Announcement not found", 404);
  if (!["draft", "scheduled"].includes(before.status)) {
    throw new AppError("Only draft or scheduled announcements can be published", 400);
  }
  if (["offline_sms", "both"].includes(before.delivery_mode) && !before.sms_template_id) {
    throw new AppError("SMS template is required before publishing offline announcements", 400);
  }
  const categorySlug = before.category_slug || "";
  if (HOLIDAY_CATEGORY_SLUGS.has(categorySlug) && !before.event_start_date) {
    throw new AppError("Holiday announcements require event_start_date", 400);
  }

  const updated = await repo.publishAnnouncement(announcementId, userId);
  if (!updated) throw new AppError("Announcement could not be published", 400);
  const published = await repo.getAnnouncementById(announcementId);
  const targets = normalizeTargets(published.targets);

  let notificationResult = null;
  let pushResult = null;
  if (["online", "both"].includes(published.delivery_mode) && (published.create_notification || published.send_push)) {
    const userIds = await repo.resolveOnlineUserIds(targets);
    if (userIds.length) {
      const payload = {
          userIds,
          category: "system",
          type: "announcement",
          entityType: "announcement",
          entityId: published.id,
          title: published.title,
          body: published.body,
          deepLink: `directkhata://announcements/${published.id}`,
        };
      if (published.create_notification) {
        notificationResult = await notificationService.notify({
          ...payload,
          sendPush: Boolean(published.send_push),
        });
        pushResult = notificationResult.dispatch?.push || null;
      } else if (published.send_push) {
        const dispatch = await notificationService.dispatchNotificationUpdate(userIds, payload, {
          sendPush: true,
          sendRealtime: false,
        });
        pushResult = dispatch.push || null;
      }
    }
  }

  let smsJob = null;
  if (["offline_sms", "both"].includes(published.delivery_mode)) {
    const recipients = await repo.resolveSmsRecipients(targets);
    smsJob = await repo.createSmsJob(published, recipients, userId);
  }

  if (HOLIDAY_CATEGORY_SLUGS.has(categorySlug)) {
    await repo.createHolidayFromAnnouncement(published, targets, userId);
  }

  return {
    announcement: await repo.getAnnouncementById(announcementId),
    notification: notificationResult,
    push: pushResult,
    sms_job: smsJob,
  };
}

export async function publishDueScheduledAnnouncements(options = {}) {
  const due = await repo.listDueScheduledAnnouncements(options.limit || process.env.ANNOUNCEMENT_PUBLISH_JOB_LIMIT || 25);
  const results = [];
  for (const item of due) {
    try {
      const result = await publishAnnouncement(item.id, item.updated_by || item.created_by || null);
      results.push({
        id: item.id,
        success: true,
        sms_job_id: result.sms_job?.id || null,
        notification_created: Boolean(result.notification),
        push_sent: Number(result.push?.sent || 0),
        push_failed: Number(result.push?.failed || 0),
      });
    } catch (err) {
      results.push({
        id: item.id,
        success: false,
        message: err.message || "Could not publish scheduled announcement",
      });
    }
  }
  return {
    checked: due.length,
    published: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  };
}

export async function cancelAnnouncement(id, userId) {
  const updated = await repo.cancelAnnouncement(intValue(id, "announcement id", true), userId);
  if (!updated) throw new AppError("Announcement cannot be cancelled", 400);
  return getAnnouncement(id);
}

export function listSmsJobs(filters) {
  return repo.listSmsJobs(filters);
}

function parseSmsVariables(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function formatSmsDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function countTemplatePlaceholders(template = {}) {
  const detected = String(template.template_content || "").match(/\{#(?:var|alp)#\}/gi)?.length || 0;
  return Number(template.placeholder_count || detected || 0);
}

function normalizeVariableList(variables, job) {
  if (Array.isArray(variables)) return variables.map((item) => String(item ?? ""));
  if (Array.isArray(variables?.values)) return variables.values.map((item) => String(item ?? ""));
  const named = variables && typeof variables === "object" ? variables : {};
  const orderedKeys = Array.isArray(named.order) ? named.order : [];
  const ordered = orderedKeys.map((key) => named[key]).filter((item) => item !== undefined && item !== null && item !== "");
  if (ordered.length) return ordered.map((item) => String(item));

  const commonKeys = [
    "start_date",
    "event_start_date",
    "end_date",
    "event_end_date",
    "reopen_date",
    "holiday",
    "reason",
    "title",
    "exam",
    "exam_date",
    "message",
  ];
  const common = commonKeys.map((key) => named[key]).filter((item) => item !== undefined && item !== null && item !== "");
  if (common.length) return common.map((item) => String(item));

  const fallback = [
    formatSmsDate(job.event_start_date),
    job.title,
    formatSmsDate(job.event_end_date),
    formatSmsDate(job.reopen_date),
  ].filter(Boolean);
  return fallback;
}

function buildVariableValues(job) {
  const requiredCount = countTemplatePlaceholders(job);
  const values = normalizeVariableList(parseSmsVariables(job.sms_variables_json), job);
  while (values.length < requiredCount) values.push("");
  return values.slice(0, requiredCount || values.length).join("|");
}

function normalizeDeliveryStatus(value) {
  const text = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["delivered", "delivery_success", "success", "completed"].includes(text)) return "delivered";
  if (["undelivered", "delivery_failed", "failed", "failure", "rejected", "expired", "blocked"].includes(text)) return "undelivered";
  if (["sent", "submitted", "accepted", "queued", "pending", "in_progress", "processing"].includes(text)) return "sent";
  return "sent";
}

function extractDeliveryEvents(payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  const candidates = [
    body.events,
    body.reports,
    body.data,
    body.result,
    body.message,
    body.messages,
    body.delivery_report,
    body.delivery_reports,
  ].filter(Boolean);
  const rows = candidates.find((item) => Array.isArray(item)) || (Array.isArray(body) ? body : [body]);
  return rows.map((item) => {
    const row = item && typeof item === "object" ? item : {};
    return {
      recipient_id: row.recipient_id || row.recipientId || row.custom_id || row.customId || null,
      sms_job_id: row.sms_job_id || row.job_id || row.jobId || null,
      provider_message_id: row.provider_message_id || row.message_id || row.messageId || row.request_id || row.requestId || row.id || null,
      phone: row.phone || row.mobile || row.number || row.to || row.recipient || null,
      status: normalizeDeliveryStatus(row.status || row.delivery_status || row.deliveryStatus || row.state),
      provider_status: row.status || row.delivery_status || row.deliveryStatus || row.state || null,
      delivered_at: row.delivered_at || row.deliveredAt || row.delivery_time || row.deliveryTime || null,
      error_message: row.error || row.error_message || row.reason || row.description || null,
    };
  });
}

async function sendFast2SmsDlt({ job, recipient }) {
  if (!isProductionEnvironment() && !allowNonProductionSms()) {
    return {
      skipped: true,
      provider_status: "skipped_non_production",
      provider_message_id: null,
    };
  }

  if (String(process.env.SMS_PROVIDER || "fast2sms").toLowerCase() !== "fast2sms") {
    throw new AppError("SMS_PROVIDER must be fast2sms", 500);
  }

  const senderId = job.header || process.env.SMS_SENDER_ID;
  if (!senderId) throw new AppError("SMS sender id is not configured", 500);

  const body = {
    route: "dlt",
    sender_id: senderId,
    message: job.dlt_template_id,
    variables_values: buildVariableValues(job),
    numbers: recipient.phone,
    flash: 0,
  };
  if (job.brand_dlt_id || process.env.SMS_ENTITY_ID) body.entity_id = job.brand_dlt_id || process.env.SMS_ENTITY_ID;

  const response = await fetch(FAST2SMS_DLT_URL, {
    method: "POST",
    headers: {
      authorization: requireConfig("SMS_API_KEY"),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  const message = payload?.message || payload?.error || payload?.return || "Could not send SMS";
  if (!response.ok || payload?.return === false) {
    throw new AppError(Array.isArray(message) ? message.join(", ") : String(message), response.status || 502);
  }
  return {
    provider_status: payload?.message ? String(Array.isArray(payload.message) ? payload.message.join(", ") : payload.message) : "accepted",
    provider_message_id: payload?.request_id || payload?.message_id || null,
    payload,
  };
}

export async function dispatchSmsJob(id, options = {}) {
  const jobId = intValue(id, "sms job id", true);
  const job = await repo.getSmsJobForDispatch(jobId);
  if (!job) throw new AppError("SMS job not found", 404);
  if (!["queued", "scheduled", "sending"].includes(job.status)) {
    return { job, attempted: 0, sent: 0, failed: 0, skipped: 0 };
  }

  if (job.status !== "sending") {
    const claimed = await repo.claimSmsJob(jobId, Boolean(options.force));
    if (!claimed) {
      return { job: await repo.getSmsJobById(jobId), attempted: 0, sent: 0, failed: 0, skipped: 0 };
    }
  }

  const batchSize = Math.max(1, Math.min(500, Number(options.batchSize || process.env.ANNOUNCEMENT_SMS_BATCH_SIZE) || 100));
  const recipients = await repo.listQueuedSmsRecipients(jobId, batchSize);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let lastError = null;

  for (const recipient of recipients) {
    try {
      const result = await sendFast2SmsDlt({ job, recipient });
      if (result.skipped) skipped += 1;
      await repo.markSmsRecipientSent(recipient.id, result);
      sent += 1;
    } catch (err) {
      lastError = err.message || "Could not send SMS";
      const retryable = recipient.attempt_count + 1 < (Number(process.env.ANNOUNCEMENT_SMS_MAX_ATTEMPTS) || 3);
      await repo.markSmsRecipientFailed(recipient.id, lastError, retryable);
      failed += 1;
    }
  }

  const updatedJob = await repo.refreshSmsJobStatus(jobId, lastError);
  return { job: updatedJob, attempted: recipients.length, sent, failed, skipped };
}

export async function dispatchDueSmsJobs(options = {}) {
  const jobs = await repo.listDueSmsJobs(options.limit || process.env.ANNOUNCEMENT_SMS_JOB_LIMIT || 5);
  const results = [];
  for (const job of jobs) {
    results.push(await dispatchSmsJob(job.id, { ...options, force: false }));
  }
  return {
    jobs: results,
    attempted: results.reduce((sum, item) => sum + item.attempted, 0),
    sent: results.reduce((sum, item) => sum + item.sent, 0),
    failed: results.reduce((sum, item) => sum + item.failed, 0),
    skipped: results.reduce((sum, item) => sum + item.skipped, 0),
  };
}

export async function applySmsDeliveryStatus(body = {}) {
  const events = extractDeliveryEvents(body);
  const results = [];
  for (const event of events) {
    const recipients = await repo.findSmsRecipientsForDeliveryUpdate(event);
    for (const recipient of recipients) {
      await repo.updateSmsRecipientDeliveryStatus(recipient.id, event);
      results.push({ recipient_id: recipient.id, sms_job_id: recipient.sms_job_id, status: event.status });
    }
  }
  const jobIds = [...new Set(results.map((item) => item.sms_job_id).filter(Boolean))];
  for (const jobId of jobIds) {
    await repo.refreshSmsJobStatus(jobId);
  }
  return { received: events.length, updated: results.length, results };
}

function buildStatusUrl(recipient) {
  const template = optionalConfig("FAST2SMS_STATUS_URL") || optionalConfig("SMS_STATUS_URL");
  if (!template) return "";
  return template
    .replace(/\{messageId\}/g, encodeURIComponent(recipient.provider_message_id || ""))
    .replace(/\{message_id\}/g, encodeURIComponent(recipient.provider_message_id || ""))
    .replace(/\{requestId\}/g, encodeURIComponent(recipient.provider_message_id || ""))
    .replace(/\{request_id\}/g, encodeURIComponent(recipient.provider_message_id || ""))
    .replace(/\{phone\}/g, encodeURIComponent(recipient.phone || ""));
}

async function fetchFast2SmsDeliveryStatus(recipient) {
  const url = buildStatusUrl(recipient);
  if (!url) {
    throw new AppError("FAST2SMS_STATUS_URL is not configured", 500);
  }
  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: requireConfig("SMS_API_KEY"),
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.return === false) {
    const message = payload?.message || payload?.error || "Could not refresh SMS delivery status";
    throw new AppError(Array.isArray(message) ? message.join(", ") : String(message), response.status || 502);
  }
  return payload;
}

export async function refreshSmsJobDeliveryStatus(id, options = {}) {
  const jobId = intValue(id, "sms job id", true);
  const job = await repo.getSmsJobById(jobId);
  if (!job) throw new AppError("SMS job not found", 404);
  const recipients = await repo.listTrackableSmsRecipients(jobId, options.limit || 500);
  let updated = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      const payload = await fetchFast2SmsDeliveryStatus(recipient);
      const result = await applySmsDeliveryStatus({
        ...payload,
        recipient_id: recipient.id,
        sms_job_id: jobId,
        provider_message_id: recipient.provider_message_id,
        phone: recipient.phone,
      });
      updated += result.updated;
    } catch {
      failed += 1;
    }
  }
  const refreshedJob = await repo.refreshSmsJobStatus(jobId);
  return { job: refreshedJob, checked: recipients.length, updated, failed };
}

export function listHolidays(filters) {
  return repo.listHolidays(filters);
}
