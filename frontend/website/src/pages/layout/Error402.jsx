import { useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { Button } from "@/components/ui/button";

const Error402 = () => {
  const navigate = useNavigate();

  return (
    <>
      <Header />
      <div className="flex min-h-[70vh] w-full flex-col items-center justify-center px-5 text-center lg:px-15 2xl:px-30">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-punch-700">
          Error 404
        </p>
        <h1 className="mt-3 text-4xl font-extrabold text-stone-900 md:text-6xl">
          Page Not Found
        </h1>
        <hr className="my-6 w-20 border-t-2 border-stone-900" />
        <p className="max-w-2xl text-sm text-stone-700 md:text-base">
          The page you are trying to open does not exist or may have been moved.
          Please return to the home page or continue browsing the website sections.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button className="rounded-2xl bg-punch-600 hover:bg-punch-800" onClick={() => navigate("/")}>
            Go To Home
          </Button>
          <Button variant="secondary" className="rounded-2xl" onClick={() => navigate("/college")}>
            Open College
          </Button>
          <Button variant="secondary" className="rounded-2xl" onClick={() => navigate("/school")}>
            Open School
          </Button>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Error402;
