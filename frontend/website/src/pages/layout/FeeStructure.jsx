import Header from "../../components/Header";
import Footer from "../../components/Footer";

const FeeStructure = ({ type }) => {
  const separateFees = (fees) => ({
    admissionFee: fees.find((fee) => fee.type === "Admission Fee"),
    installmentFees: fees.filter((fee) => fee.type !== "Admission Fee"),
  });

  const SchoolItems = [
    {
      title: "Nursery, LKG & UKG",
      fees: [
        { type: "Admission Fee", amount: "₹ 8,000" },
        { type: "1st Installment", amount: "₹ 4,000" },
        { type: "2nd Installment", amount: "₹ 4,000" },
        { type: "3rd Installment", amount: "₹ 4,000" },
      ],
    },
    {
      title: "Class I & II",
      fees: [
        { type: "Admission Fee", amount: "₹ 9,500" },
        { type: "1st Installment", amount: "₹ 4,000" },
        { type: "2nd Installment", amount: "₹ 4,000" },
        { type: "3rd Installment", amount: "₹ 4,000" },
      ],
      // text: "1st Installment fees (Due date 1st week of June)",
    },
    {
      title: "Class III, IV & V",
      fees: [
        { type: "Admission Fee", amount: "₹ 10,500" },
        { type: "1st Installment", amount: "₹ 4,000" },
        { type: "2nd Installment", amount: "₹ 4,000" },
        { type: "3rd Installment", amount: "₹ 4,000" },
      ],
    },
    {
      title: "Class VI, VII, VIII, IX & X",
      fees: [
        { type: "Admission Fee", amount: "₹ 10,800" },
        { type: "1st Installment", amount: "₹ 4,000" },
        { type: "2nd Installment", amount: "₹ 4,000" },
        { type: "3rd Installment", amount: "₹ 4,000" },
      ],
    },
  ];

  const CollegeItems = [
    {
      title: "Arts",
      fees: [
        { type: "Admission Fee", amount: "₹ 12,500" },
        { type: "1st Installment", amount: "₹ 5,500" },
        { type: "2nd Installment", amount: "₹ 5,500" },
        { type: "3rd Installment", amount: "₹ 5,500" },
      ],
      text: "1st Installment fees (Due date 1st week of June)",
    },
    {
      title: "Science",
      fees: [
        { type: "Admission Fee", amount: "₹ 19,500" },
        { type: "1st Installment", amount: "₹ 8,500" },
        { type: "2nd Installment", amount: "₹ 8,500" },
        { type: "3rd Installment", amount: "₹ 8,500" },
      ],
      text: "2nd Installment fees (Due date 1st week of September)",
    },
    {
      title: "Commerce",
      fees: [
        { type: "Admission Fee", amount: "₹ 12,500" },
        { type: "1st Installment", amount: "₹ 5,500" },
        { type: "2nd Installment", amount: "₹ 5,500" },
        { type: "3rd Installment", amount: "₹ 5,500" },
      ],
      text: 
      "3rd Installment fees (Due date 2nd week of November)",
        
    },
  ];
  const Items = type === "school" ? SchoolItems : CollegeItems;
  return (
    <>
      <Header />

      <div className="flex flex-col items-center px-5 lg:px-15 2xl:px-30">
        <p className="text-3xl md:text-5xl font-extrabold mt-10">
          Fee <span className="text-gradient-bg bg-clip-text">Structure</span>
        </p>

        {/* <hr className="w-20 my-5 border-t-2 border-stone-900" /> */}
<p className="text-xl md:text-3xl font-extrabold mt-5">
          <span className="">Admission Fee </span>
        </p>
        <hr className="w-20 my-5 border-t-2 border-stone-900" />
        <div
          className={`grid grid-cols-1 md:grid-cols-2  gap-6 w-full ${type === "school" ? "2xl:grid-cols-4" : "2xl:grid-cols-3"}`}
        >
          {Items.map((group, index) => (
            <div
              key={index}
              className="border border-stone-200 rounded-xl shadow-md p-6"
            >
              <p className="font-bold text-lg mb-4 text-center">{group.title}</p>

              {(() => {
                const { admissionFee } = separateFees(group.fees);

                return (
                  <>
                    {admissionFee ? (
                      <div className="border border-stone-200 rounded-lg bg-stone-50 p-4 mb-5">
                        {/* <p className="font-semibold mb-2">{admissionFee.type}</p> */}
                        <div className="flex justify-between">
                          <span>{admissionFee.type}</span>
                          <span>{admissionFee.amount}</span>
                        </div>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        <p className="text-xl md:text-3xl font-extrabold my-6">
          <span className="">Monthly Fee </span>
        </p>
        <hr className="w-20 my-1 border-t-2 border-stone-900" />
        <p className="text-xl md:text-3xl font-extrabold my-6">
          <span className="">বছৰৰ Monthly Fee সমূহ তিনিটা installment ত ভগাই দিয়া হৈছে ।</span>
        </p>
        <div
          className={`grid grid-cols-1 md:grid-cols-2  gap-6 w-full ${type === "school" ? "2xl:grid-cols-4" : "2xl:grid-cols-3"}`}
        >
          {Items.map((group, index) => (
            <div
              key={index}
              className="border border-stone-200 rounded-xl shadow-md p-6"
            >
              <p className="font-bold text-lg mb-4 text-center">{group.title}</p>

              {(() => {
                const { installmentFees } = separateFees(group.fees);

                return (
                  <>
                    <div className="border border-stone-200 rounded-lg p-4">
                      {/* <p className="font-semibold mb-2">Installment Fee</p> */}
                      <table className="w-full">
                        <tbody>
                          {installmentFees.map((fee, i) => (
                            <tr key={i} className="flex justify-between py-1 border-b last:border-b-0">
                              <td>{fee.type}</td>
                              <td>{fee.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}

              <p className="font-bold mt-5">
                {group.text}
              </p>
            </div>
          ))}
        </div>
        <p className="my-5">
          N.B: If session fees are not paid with the stipulated time, the name
          of the defaulter student will be struck off from the Admission
          Register. Fees once received are not refundable.
        </p>
      </div>

      <Footer />
    </>
  );
};

export default FeeStructure;
