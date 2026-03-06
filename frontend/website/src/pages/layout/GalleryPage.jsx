import Footer from "../../components/Footer";
import Header from "../../components/Header";

const Gallery = ({ Text }) => {

  const schoolImages = import.meta.glob(
    "../../assets/gallery/school/*.{jpg,jpeg,png}",
    { eager: true }
  );

  const collegeImages = import.meta.glob(
    "../../assets/gallery/college/*.{jpg,jpeg,png}",
    { eager: true }
  );

  const images = Text === "school"
    ? Object.values(schoolImages)
    : Object.values(collegeImages);

  const imageList = images.map((img, index) => ({
    id: index + 1,
    src: img.default
  }));

  return (
    <>
    <Header />
    <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">

      <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12">
        Image <span className="text-gradient-bg bg-clip-text">Gallery</span>
      </p>

      <hr className="w-20 my-5 border-t-2 border-stone-900" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">

        {imageList.map((img) => (
          <img
            key={img.id}
            src={img.src}
            alt={`gallery-${img.id}`}
            className="w-full object-cover aspect-square rounded-10px border border-stone-100"
          />
        ))}

      </div>
    </div>
    <Footer />
    </>
  );
};

export default Gallery;