const Footer = () => {
  return (
    <div className="w-full text-sm md:text-base text-center p-1.5 md:p-4 border border-t-stone-100">
      <p >
        All rights reserved | Designed &amp; managed by{" "}
        <span
          onClick={() => (window.location.href = `http://techdevcreators.com/`)}
        className="text-gradient-bg bg-clip-text transition hover:underline cursor-pointer"
        >
          Tech Dev Creators
        </span>
      </p>
    </div>
  );
};

export default Footer;