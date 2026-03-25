import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { DEFAULT_IMAGE, SITE_NAME, SITE_URL, buildSeoConfig } from "./seoConfig";

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function ensureLink(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

export default function SeoManager() {
  const location = useLocation();
  const seo = useMemo(() => buildSeoConfig(location.pathname), [location.pathname]);

  useEffect(() => {
    document.title = seo.title;

    ensureMeta('meta[name="description"]', {
      name: "description",
      content: seo.description,
    });
    ensureMeta('meta[property="og:title"]', {
      property: "og:title",
      content: seo.title,
    });
    ensureMeta('meta[property="og:description"]', {
      property: "og:description",
      content: seo.description,
    });
    ensureMeta('meta[property="og:type"]', {
      property: "og:type",
      content: seo.type,
    });
    ensureMeta('meta[property="og:url"]', {
      property: "og:url",
      content: seo.canonical,
    });
    ensureMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: SITE_NAME,
    });
    ensureMeta('meta[property="og:image"]', {
      property: "og:image",
      content: seo.image,
    });
    ensureMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });
    ensureMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: seo.title,
    });
    ensureMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: seo.description,
    });
    ensureMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: seo.image,
    });

    ensureLink('link[rel="canonical"]', {
      rel: "canonical",
      href: seo.canonical,
    });

    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "EducationalOrganization",
          "@id": `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: SITE_URL,
          logo: DEFAULT_IMAGE,
          email: "kalongkapilividyapith@gmail.com",
          telephone: ["+91-9954128216", "+91-9435161539", "+91-7002136988"],
          address: {
            "@type": "PostalAddress",
            addressLocality: "Nagaon",
            addressRegion: "Assam",
            addressCountry: "IN",
          },
        },
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          url: SITE_URL,
          name: SITE_NAME,
          publisher: {
            "@id": `${SITE_URL}/#organization`,
          },
        },
        {
          "@type": "WebPage",
          "@id": `${seo.canonical}#webpage`,
          url: seo.canonical,
          name: seo.title,
          description: seo.description,
          isPartOf: {
            "@id": `${SITE_URL}/#website`,
          },
          about: {
            "@id": `${SITE_URL}/#organization`,
          },
        },
      ],
    };

    let script = document.head.querySelector('script[data-seo-schema="website"]');
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-schema", "website");
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);
  }, [seo]);

  return null;
}
