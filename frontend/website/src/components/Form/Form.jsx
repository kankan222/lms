import { Button } from "../ui/button";

const Form = () => {
  return (
    <div className="w-full flex items-center justify-center">
      <form
        action=""
        className="border border-stone-100 rounded-xl flex  justify-center flex-col p-5 md:p-10 w-full md:min-w-187.5 gap-3 shadow-punch-secondary bg-stone-50"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="" className="text-sm ml-1 text-stone-600">
            Name
          </label>
          <input type="text" className="border border-stone-200 rounded-[6px] p-2 font-sm bg-white"/>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="" className="text-sm ml-1 text-stone-600">
            Contact Number
          </label>
          <input type="text" className="border border-stone-200 rounded-[6px] p-2 bg-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="" className="text-sm ml-1 text-stone-600">
            Message <span className="text-stone-400 text-xs">(*optional)</span>
          </label>
          <textarea name="" id="" className="border border-stone-200 rounded-[6px] p-2 rows resize-none bg-white" rows={5} ></textarea>
        </div>
        <Button>Submit</Button>
      </form>
    </div>
  );
};

export default Form;
