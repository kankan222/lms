import Header from "../../components/Header";
import Footer from "../../components/Footer";

const POLICY_SECTIONS = [
  {
    title: "Privacy Policy",
    text: `This Privacy Policy explains how Kalong Kapili Vidyapith and KKV Group Of Institutions collect, use, store, and protect information through our website, school and college software systems, and mobile application. By using our website, software portal, or mobile app, you agree to the practices described in this policy.`,
  },
  {
    title: "Information We Collect",
    text: `We may collect personal and institutional information including student details, parent and guardian information, teacher and staff records, contact information, login credentials, attendance records, class and subject data, fee and payment records, examination and marks data, messages sent through the system, uploaded photos, and documents required for academic or administrative purposes.`,
  },
  {
    title: "How We Use Information",
    text: `The information collected through our system is used to manage admissions, student records, attendance, examinations, report generation, fee collection, staff administration, parent communication, user authentication, role-based access control, and mobile or web access to institution services. We use this information only for educational, operational, security, compliance, and communication purposes connected with the institution.`,
  },
  {
    title: "Mobile App And Account Access",
    text: `Our mobile application and software portal allow authorized users such as administrators, teachers, parents, students, and staff to sign in securely and access relevant records based on their role. Authentication tokens and account session data may be stored on user devices to keep users signed in and to protect account access. Access is limited according to account permissions defined by the institution.`,
  },
  {
    title: "Photos, Files, And Uploaded Content",
    text: `The system may store profile photos, staff images, student images, receipts, marksheets, and other uploaded records required for institutional operations or public website sections. Public website content such as approved staff listings is published only for display purposes determined by the institution. Internal records remain restricted to authorized users.`,
  },
  {
    title: "Sharing Of Information",
    text: `We do not sell personal information. Information may be shared internally with authorized school or college administrators, teachers, accountants, staff members, parents, or students where necessary for academic administration, communication, or compliance. Data may also be processed by technical service providers involved in hosting, storage, backup, or system maintenance under institutional control.`,
  },
  {
    title: "Data Security",
    text: `We use account authentication, restricted access by role, protected administrative workflows, and server-based storage measures to reduce unauthorized access, disclosure, or misuse of data. While reasonable efforts are taken to secure the platform, no internet-based service can guarantee absolute security.`,
  },
  {
    title: "Data Retention",
    text: `Institutional records may be retained for as long as required for academic history, administrative management, legal obligations, financial reconciliation, security review, or institutional reporting. Public website content may remain available until it is updated or removed by the institution.`,
  },
  {
    title: "Children's Privacy",
    text: `The platform may process data relating to students who are minors for legitimate educational and administrative purposes of the institution. Such data is managed by the institution and accessed only by authorized users such as administrators, teachers, parents, or guardians, as applicable.`,
  },
  {
    title: "Your Rights",
    text: `You may request correction of inaccurate personal information or raise concerns about data handling through the institution's administration. Requests may be reviewed subject to academic, administrative, legal, and operational requirements.`,
  },
  {
    title: "Policy Updates",
    text: `This Privacy Policy may be updated from time to time to reflect changes in institutional practices, legal requirements, or platform functionality. The latest version published on this page will apply to current use of the website, software, and mobile application.`,
  },
  {
    title: "Contact",
    text: `For privacy-related questions regarding this system, users may contact Kalong Kapili Vidyapith or KKV Group Of Institutions through the official administrative contact channels published by the institution.`,
  },
];

const PrivacyPolicy = () => {
  return (
    <>
      <Header />
      <div className="flex h-full w-full flex-col items-center justify-center px-5 sm:text-center lg:px-15 2xl:px-30">
        <p className="relative mt-8 text-3xl font-extrabold md:text-5xl sm:mt-12">
          <span className="text-gradient-bg bg-clip-text">Privacy Policy</span>
        </p>
        <hr className="my-5 w-20 border-t-2 border-stone-900" />

        {POLICY_SECTIONS.map((section, index) => (
          <div key={section.title} className="flex flex-col items-center justify-center">
            <p className="mb-2 text-base text-black md:text-lg">{section.title}</p>
            <p className="whitespace-pre-line text-sm">{section.text}</p>
            {index < POLICY_SECTIONS.length - 1 ? (
              <hr className="my-5 w-20 border-t-2 border-stone-900" />
            ) : null}
          </div>
        ))}
      </div>
      <Footer />
    </>
  );
};

export default PrivacyPolicy;
