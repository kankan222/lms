import Header from "../../components/Header";
import Footer from "../../components/Footer";
import Staff from "../../components/Staff/Staff";

const StaffPage = ({ type }) => {
  return (
    <>
      <Header />
      <Staff type={type} />
      <Footer />
    </>
  );
};

export default StaffPage;
