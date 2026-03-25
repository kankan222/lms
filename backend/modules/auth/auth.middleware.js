import { verifyAccessToken } from "../../core/auth/jwt.js";

export function authenticate(req, res, next) {
  try {

    const header = req.headers.authorization;
    const tokenFromHeader =
      header && header.startsWith("Bearer ")
        ? header.split(" ")[1]
        : null;
    const token = tokenFromHeader || req.query?.access_token;

    if (!token)
      return res.status(401).json({message:"No token"});

    const decoded = verifyAccessToken(token);

    req.user = decoded;

    next();

  } catch {
    return res.status(401).json({message:"Unauthorized"});
  }
}

export function requirePermission(permission) {
  return (req, res, next) => {
console.log("auth middle ware hit")
    if (!req.user.permissions?.includes(permission)) {
      return res.status(403).json({
        message: "Forbidden"
      });
    }

    next();
  };
}
// EXAMPLE 
// router.post(
//   "/students",
//   authenticate,
//   requirePermission("student.create"),
//   controller.createStudent
// );
