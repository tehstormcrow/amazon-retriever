import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import { PassportLocalSchema} from "mongoose";

const schema = new mongoose.Schema({
  username: String,
  password: String
});

schema.plugin(passportLocalMongoose);

const User = mongoose.model("User", schema as PassportLocalSchema);

export default User;
