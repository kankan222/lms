const StaffCard = ({ src, name, role, subtitle }) => {
  return (
    <div className="overflow-hidden rounded-xl border bg-black text-white shadow-lg">
      <div className="relative">
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-90 w-full object-cover"
        />
      </div>

      <div className="p-5 flex flex-col gap-1">
        <p className="text-xl font-semibold">{name}</p>
        <p className="text-sm text-gray-400">{role}</p>
        {subtitle ? <p className="text-sm text-gray-500">{subtitle}</p> : null}
      </div>
    </div>
  );
};

export default StaffCard;
