const Skeleton = ({ className = "", count = 1 }) => {
  const items = Array.from({ length: count });

  return (
    <>
      {items.map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`relative overflow-hidden rounded-md bg-gray-300 dark:bg-gray-700 ${className}`}
        >
          {/* Shimmer Effect */}

          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        </div>
      ))}
    </>
  );
};

export default Skeleton;
