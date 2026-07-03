import * as transportService from "./transport.service.js";

function sendData(res, data) {
  return res.json({ success: true, data });
}

function mapTransportError(err, res) {
  if (err?.code === "ER_DUP_ENTRY") {
    return res.status(400).json({
      success: false,
      message: "A matching transportation record already exists",
    });
  }
  if (err?.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(400).json({
      success: false,
      message: "Cannot delete this record because it is already used",
    });
  }
  if (typeof err?.statusCode === "number") {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }
  console.error(err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

export async function listRoutes(req, res) {
  try {
    return sendData(res, await transportService.listRoutes());
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function createRoute(req, res) {
  try {
    return sendData(res, await transportService.createRoute(req.body || {}));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function updateRoute(req, res) {
  try {
    return sendData(res, await transportService.updateRoute(req.params.id, req.body || {}));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function listStops(req, res) {
  try {
    return sendData(res, await transportService.listStops(req.query?.route_id || null));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function createStop(req, res) {
  try {
    return sendData(res, await transportService.createStop(req.body || {}));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function updateStop(req, res) {
  try {
    return sendData(res, await transportService.updateStop(req.params.id, req.body || {}));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function searchStudents(req, res) {
  try {
    return sendData(res, await transportService.searchStudents(req.query || {}));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function listAssignments(req, res) {
  try {
    return sendData(res, await transportService.listAssignments(req.query || {}));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function createAssignment(req, res) {
  try {
    return sendData(res, await transportService.createAssignment(req.body || {}, req.user));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function endAssignment(req, res) {
  try {
    return sendData(res, await transportService.endAssignment(req.params.id, req.body || {}));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function listDues(req, res) {
  try {
    return sendData(res, await transportService.listDues(req.query || {}));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function createPayment(req, res) {
  try {
    return sendData(res, await transportService.createPayment(req.body || {}, req.user));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function listPayments(req, res) {
  try {
    return sendData(res, await transportService.listPayments(req.query || {}));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function updatePayment(req, res) {
  try {
    return sendData(res, await transportService.updatePayment(req.params.id, req.body || {}, req.user));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function deletePayment(req, res) {
  try {
    return sendData(res, await transportService.deletePayment(req.params.id, req.user));
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function getSummary(req, res) {
  try {
    return sendData(res, await transportService.getSummary());
  } catch (err) {
    return mapTransportError(err, res);
  }
}

export async function downloadReceipt(req, res) {
  try {
    const pdfBuffer = await transportService.generateReceipt(req.params.paymentId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transport-receipt-${req.params.paymentId}.pdf`
    );
    return res.send(pdfBuffer);
  } catch (err) {
    return mapTransportError(err, res);
  }
}
