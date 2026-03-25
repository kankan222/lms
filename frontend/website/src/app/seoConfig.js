const SITE_NAME = "Kalong Kapili Vidyapith";
const SITE_URL = "https://www.kalongkapilividyapith.com";
const DEFAULT_IMAGE = `${SITE_URL}/assets/site/logobg.png`;
const DEFAULT_DESCRIPTION =
  "Kalong Kapili Vidyapith in Nagaon, Assam offers school, higher secondary, and computer education with experienced faculty, campus facilities, admissions, and student support.";

function buildSeoConfig(pathname) {
  const pageMap = {
    "/": {
      title: `${SITE_NAME} | School, Higher Secondary & Computer Education in Nagaon`,
      description:
        "Explore Kalong Kapili Vidyapith's school section, higher secondary section, and computer education centre in Nagaon, Assam.",
      type: "website",
    },
    "/contact-us": {
      title: `Contact ${SITE_NAME} | Campus Address, Phone & Email`,
      description:
        "Get contact details, phone numbers, email, and campus addresses for the school and higher secondary sections of Kalong Kapili Vidyapith.",
    },
    "/privacy-policy": {
      title: `Privacy Policy | ${SITE_NAME}`,
      description: `Read the privacy policy for ${SITE_NAME} and understand how website and admission form information is handled.`,
    },
    "/college": {
      title: `Higher Secondary Section | ${SITE_NAME}`,
      description:
        "Discover the higher secondary section of Kalong Kapili Vidyapith with Arts, Science, and Commerce streams in English and Assamese medium.",
    },
    "/college/facilities": {
      title: `Higher Secondary Facilities | ${SITE_NAME}`,
      description:
        "See the campus facilities, classrooms, labs, library, safety features, and student amenities available in the higher secondary section.",
    },
    "/college/gallery": {
      title: `Higher Secondary Gallery | ${SITE_NAME}`,
      description:
        "Browse campus and activity images from the higher secondary section of Kalong Kapili Vidyapith.",
    },
    "/college/fee-structure": {
      title: `Higher Secondary Fee Structure | ${SITE_NAME}`,
      description:
        "Check the higher secondary admission fee and installment fee structure for Arts, Science, and Commerce at Kalong Kapili Vidyapith.",
    },
    "/college/staff": {
      title: `Higher Secondary Staff | ${SITE_NAME}`,
      description:
        "Meet the head staff, teaching staff, and non-teaching staff of the higher secondary section at Kalong Kapili Vidyapith.",
    },
    "/college/rules": {
      title: `Higher Secondary Rules | ${SITE_NAME}`,
      description:
        "Read the rules, discipline expectations, and student guidance for the higher secondary section of Kalong Kapili Vidyapith.",
    },
    "/school": {
      title: `School Section | ${SITE_NAME}`,
      description:
        "Explore the school section of Kalong Kapili Vidyapith offering classes from Nursery to Class X in English and Assamese medium.",
    },
    "/school/facilities": {
      title: `School Facilities | ${SITE_NAME}`,
      description:
        "See the classrooms, library, science labs, safety systems, and student facilities available in the school section.",
    },
    "/school/gallery": {
      title: `School Gallery | ${SITE_NAME}`,
      description:
        "Browse school campus and activity images from the school section of Kalong Kapili Vidyapith.",
    },
    "/school/fee-structure": {
      title: `School Fee Structure | ${SITE_NAME}`,
      description:
        "Check the school admission fee and installment fee structure for Nursery to Class X at Kalong Kapili Vidyapith.",
    },
    "/school/staff": {
      title: `School Staff | ${SITE_NAME}`,
      description:
        "Meet the head staff, teachers, and non-teaching staff of the school section at Kalong Kapili Vidyapith.",
    },
    "/school/rules": {
      title: `School Rules | ${SITE_NAME}`,
      description:
        "Read the school rules, discipline standards, and student guidance for the school section of Kalong Kapili Vidyapith.",
    },
    "/computer": {
      title: `Computer Courses | ${SITE_NAME}`,
      description:
        "Explore EMAX India computer education courses, diploma programs, and short-term computer training offered through Kalong Kapili Vidyapith.",
    },
  };

  const page = pageMap[pathname] || {
    title: `${SITE_NAME} | Nagaon, Assam`,
    description: DEFAULT_DESCRIPTION,
    type: "website",
  };

  return {
    title: page.title,
    description: page.description,
    canonical: `${SITE_URL}${pathname}`,
    image: DEFAULT_IMAGE,
    type: page.type || "website",
  };
}

export { SITE_NAME, SITE_URL, DEFAULT_IMAGE, buildSeoConfig };
