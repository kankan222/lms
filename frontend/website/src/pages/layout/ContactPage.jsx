import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { Mail, MapPin, Phone } from "lucide-react";

const contactNumbers = [
  "9954128216",
  "9435161539",
  "7002136988",
];

const locations = [
  {
    title: "School Section",
    address: "Backside of Nagaon College, G.M. Road, Nagaon, Assam",
    mapQuery: "Kalong Kapili Vidyapith School Section, GM Road, Nagaon, Assam",
  },
  {
    title: "Higher Secondary Section",
    address: "Head Office, ADP Road, Christian Patty, Nagaon, Assam",
    mapQuery:
      "Kalong Kapili Vidyapith Higher Secondary Section, ADP Road, Christian Patty, Nagaon, Assam",
  },
];

const ContactPage = () => {
  return (
    <>
      <Header />

      <div className="flex flex-col items-center px-5 lg:px-15 2xl:px-30">
        <p className="text-3xl md:text-5xl font-extrabold mt-10">
          Contact <span className="text-gradient-bg bg-clip-text">Us</span>
        </p>

        <hr className="w-20 my-5 border-t-2 border-stone-900" />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
          <div className="border border-stone-200 rounded-xl shadow-md p-6 xl:col-span-1 bg-white">
            <p className="font-bold text-2xl mb-5">Get in Touch</p>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-punch-100 text-punch-700 rounded-full p-2">
                    <Phone size={18} />
                  </div>
                  <p className="font-semibold text-lg">Phone Numbers</p>
                </div>
                <div className="space-y-2">
                  {contactNumbers.map((number) => (
                    <a
                      key={number}
                      href={`tel:${number}`}
                      className="block text-stone-700 hover:text-punch-700 transition-colors"
                    >
                      {number}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-punch-100 text-punch-700 rounded-full p-2">
                    <Mail size={18} />
                  </div>
                  <p className="font-semibold text-lg">Email</p>
                </div>
                <a
                  href="mailto:kalongkapilividyapith@gmail.com"
                  className="text-stone-700 hover:text-punch-700 transition-colors break-all"
                >
                  kalongkapilividyapith@gmail.com
                </a>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-punch-100 text-punch-700 rounded-full p-2">
                    <MapPin size={18} />
                  </div>
                  <p className="font-semibold text-lg">Campus Addresses</p>
                </div>
                <div className="space-y-4">
                  {locations.map((location) => (
                    <div key={location.title}>
                      <p className="font-semibold text-stone-900">
                        {location.title}
                      </p>
                      <p className="text-stone-700">{location.address}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {locations.map((location) => (
            <div
              key={location.title}
              className="border border-stone-200 rounded-xl shadow-md overflow-hidden bg-white"
            >
              <div className="p-6 pb-4">
                <p className="font-bold text-xl">{location.title}</p>
                <p className="text-stone-600 mt-2">{location.address}</p>
              </div>

              <div className="px-6 pb-6">
                <div className="rounded-xl overflow-hidden border border-stone-200">
                  <iframe
                    title={`${location.title} map`}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(location.mapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    width="100%"
                    height="320"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </>
  );
};

export default ContactPage;
