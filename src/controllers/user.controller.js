import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js"; 
import {User} from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
ApiResponse
const registerUser = asyncHandler(async (req, res) => {
    //get user data from frontend
    //validation- not empty
    //check if user already exists:usrname, email
    //check for images and avatar
    //upload them to cloudinary,avatar
    //create user object-create user in db
    //remove password and refresh token from user object
    //check for user creation
    //return response

    const{fullname,email,username,password}=req.body; // This will contain the user data from the frontend
    if (!fullname || !email || !username || !password) {
        throw new ApiError(400, "All fields are required");
    }
    const existUser=User.findOne({$or:[{email},{username}]})
    if (existUser) {
        throw new ApiError(401, "User already exists with this email or username");
    }
    const avatarLocalPath=req.files?.avatar[0]?.path;
    const coverImageLocalPath=req.files?.coverImage[0].path;

    if (!avatarLocalPath || !coverImageLocalPath) {
        throw new ApiError(402, "Avatar required");
    }

    const avatar=await uploadToCloudinary(avatarLocalPath);
    const coverImage=await uploadToCloudinary(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(403, "Avatar upload failed");
    }
    const user= await User.create({
        fullname,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser=await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "User creation failed");
    }

    return res.status(200).json(
        new ApiResponse(200, createdUser, "User created successfully")
    );

});

export { registerUser };
