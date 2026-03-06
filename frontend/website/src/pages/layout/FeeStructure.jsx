import Header from "../../components/Header";
import Footer from "../../components/Footer";

const FeeStructure = ({ type }) => {
  const SchoolItems = [
    {
      title: "Nursery, LKG & UKG",
      fees: [
        { type: "Admission Fee", amount: "₹ 8,000" },
        { type: "1st Installment", amount: "₹ 4,400" },
        { type: "2nd Installment", amount: "₹ 4,400" },
        { type: "3rd Installment", amount: "₹ 4,400" },
      ],
    },
    {
      title: "Class I & II",
      fees: [
        { type: "Admission Fee", amount: "₹ 9,500" },
        { type: "1st Installment", amount: "₹ 4,400" },
        { type: "2nd Installment", amount: "₹ 4,400" },
        { type: "3rd Installment", amount: "₹ 4,400" },
      ],
      // text: "1st Installment fees (Due date 1st week of June)",
    },
    {
      title: "Class III, IV & V",
      fees: [
        { type: "Admission Fee", amount: "₹ 10,500" },
        { type: "1st Installment", amount: "₹ 4,400" },
        { type: "2nd Installment", amount: "₹ 4,400" },
        { type: "3rd Installment", amount: "₹ 4,400" },
      ],
    },
    {
      title: "Class VI, VII, VIII, IX & X",
      fees: [
        { type: "Admission Fee", amount: "₹ 10,500" },
        { type: "1st Installment", amount: "₹ 4,400" },
        { type: "2nd Installment", amount: "₹ 4,400" },
        { type: "3rd Installment", amount: "₹ 4,400" },
      ],
    },
  ];

  const CollegeItems = [
    {
      title: "Arts",
      fees: [
        { type: "Admission Fee", amount: "₹ 12,500" },
        { type: "1st Installment", amount: "₹ 5,000" },
        { type: "2nd Installment", amount: "₹ 5,000" },
        { type: "3rd Installment", amount: "₹ 5,000" },
      ],
      text: "1st Installment fees (Due date 1st week of June)",
    },
    {
      title: "Science",
      fees: [
        { type: "Admission Fee", amount: "₹ 19,500" },
        { type: "1st Installment", amount: "₹ 8,000" },
        { type: "2nd Installment", amount: "₹ 8,000" },
        { type: "3rd Installment", amount: "₹ 8,000" },
      ],
      text: "2nd Installment fees (Due date 1st week of September)",
    },
    {
      title: "Commerce",
      fees: [
        { type: "Admission Fee", amount: "₹ 12,500" },
        { type: "1st Installment", amount: "₹ 5,000" },
        { type: "2nd Installment", amount: "₹ 5,000" },
        { type: "3rd Installment", amount: "₹ 5,000" },
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

        <hr className="w-20 my-5 border-t-2 border-stone-900" />

        <div
          className={`grid grid-cols-1 md:grid-cols-2  gap-6 w-full ${type === "school" ? "2xl:grid-cols-4" : "2xl:grid-cols-3"}`}
        >
          {Items.map((group, index) => (
            <div
              key={index}
              className="border border-stone-200 rounded-xl shadow-md p-6"
            >
              <p className="font-bold text-lg mb-4">{group.title}</p>

              <table className="w-full">
                <tbody>
                  {group.fees.map((fee, i) => (
                    <tr key={i} className="flex justify-between py-1 border-b">
                      <td>{fee.type}</td>
                      <td>{fee.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
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
