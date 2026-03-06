const Skeleton = ({ className = "" }) => {
  return (
    <div
      className={`relative overflow-hidden bg-gray-300 dark:bg-gray-700 rounded-md ${className}`}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
    </div>
  );
};

export default Skeleton;
