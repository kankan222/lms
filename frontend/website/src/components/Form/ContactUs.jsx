import Form from "./Form"

const ContactUs = () => {
  return (
    <div className='flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30 mb-5'>
      <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative">
        <span className="text-gradient-bg bg-clip-text">Contact</span> Us
      </p>
      <hr className="w-20 my-5 border-t-2 border-stone-900" />
      <Form />
    </div>
  )
}

export default ContactUs
