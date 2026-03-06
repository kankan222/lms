const StaffCard = ({ src, name, role, subtitle }) => {
  return (
    <div className="w-75 rounded-sm overflow-hidden bg-black text-white shadow-lg">

      <div className="relative">
        <img
          src={src}
          alt={name}
          className="w-full h-90 object-cover"
        />
      </div>

      <div className="p-5 flex flex-col gap-1">

        <p className="text-xl font-semibold">
          {name}
        </p>

        <p className="text-sm text-gray-400">
          {role}
        </p>

        <p className="text-sm text-gray-500">
          {subtitle}
        </p>

      </div>

    </div>
  );
};

export default StaffCard;