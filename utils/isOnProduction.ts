export const isOnProduction = () => {
  return process.env.NODE_ENV === "production";
};

export default isOnProduction;
