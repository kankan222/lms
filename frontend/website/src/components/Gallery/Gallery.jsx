import { Button } from "../ui/button";

import { Link } from "react-router-dom";
const Gallery = ({ Text }) => {
  const folder =
    Text === "school" ? "assets/gallery/school" : "assets/gallery/college";
  const totalImages = 4;

  const Images = Array.from({ length: totalImages }, (_, i) => ({
    id: i + 1,
    src: `${folder}/image-${i + 1}.jpeg`,
  }));

  const section = location.pathname.split("/")[1];
  return (
    <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">
      <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative">
        Image <span className="text-gradient-bg bg-clip-text">Gallery</span>
      </p>
      <hr className="w-20 my-5 border-t-2 border-stone-900 " />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        {Images.map((img, i) => (
          <img
            key={i}
            src={img.src}
            alt={img.id}
            className="w-100 object-cover aspect-square rounded-10px overflow-hidden border border-stone-100 "
          />
        ))}
      </div>
      <Link to={`/${section}/gallery`}>
        <Button variant="secondary" className="my-5">
          See More
        </Button>
      </Link>
    </div>
  );
};

export default Gallery;
