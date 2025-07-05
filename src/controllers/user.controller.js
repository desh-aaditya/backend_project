import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose"; 

const generateAccessandRefreshTokens=async(userId)=>{
    try {
        const user = await User.findById(userId)
        if (!user) {
            throw new ApiError(404, "User not found")
        }
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return {
            accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500, "something went wrong while generating tokens")
    }
}


const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {fullName, email, username, password } = req.body
    //console.log("email: ", email);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

const loginUser=asyncHandler(async(req, res) => {
    // get user details from frontend
    // check if user exists: username,email
    // check for password
    //access token generation and refresh token generation
    //send in cookies

    const{email,username,password}=req.body
    if(!(email || username) || !password){
        throw new ApiError(400, "Email or Username and Password are required")
    }
    const user=await User.findOne({
        $or: [{ email }, { username }]
    })
    if(!user){
        throw new ApiError(404, "User not found")
    };
    const ispasswordValid=await user.isPasswordCorrect(password)
    if(!ispasswordValid){
        throw new ApiError(401, "Invalid Password")
    }

    const{accessToken,refreshToken}=await generateAccessandRefreshTokens(user._id)
    const loggedInUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200).cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(new ApiResponse(200, {
        user:loggedInUser,
        accessToken,
        refreshToken
    }, "User logged in successfully"))
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) =>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized, please login again")
    }
    try {
        const decodedToken=jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user=await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(404, "User not found")
        }
        if(user?.refreshToken !== incomingRefreshToken){
            throw new ApiError(401, "Unauthorized, please login again")
        }
        const options = {
            httpOnly: true,
            secure: true
        }
        const{accessToken,newrefreshToken}=await generateAccessandRefreshTokens(user._id)
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(new ApiResponse(200, {
            accessToken,
            refreshToken: newrefreshToken
        }))
    } catch (error) {
        throw new ApiError(401, "Unauthorized, please login again")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Old password and new password are required");
    }
    const user=await User.findById(req.user?.id)
    const isPassword=await user.isPasswordCorrect(oldPassword)
    if(!isPassword){
        throw new ApiError(401, "Old password is incorrect")
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });  
    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
    })

const getCurrentUser = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"));


})

const updateAccountDetails= asyncHandler(async (req, res) => {
    const { fullName, email, username } = req.body;
    if ([fullName, email, username].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }
    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    user.fullName = fullName;
    user.email = email;
    user.username = username.toLowerCase();
    await user.save();
    return res.status(200).json(new ApiResponse(200, user, "User details updated successfully"));
});

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path; 
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }
    const user= await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    user.avatar = avatar.url;
    await user.save({ validateBeforeSave: false });
    return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})


const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerDetails", // <-- avoid name conflict
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: { $first: "$ownerDetails" } // use new field name
                        }
                    },
                    {
                        $project: {
                            ownerDetails: 0 // optionally remove the temporary field
                        }
                    }
                ]
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            user[0]?.watchHistory || [],
            "Watch history fetched successfully"
        )
    );
});


export {
    registerUser,loginUser,logoutUser,refreshAccessToken,changeCurrentPassword,getCurrentUser,updateAvatar,updateAccountDetails,getUserChannelProfile,getWatchHistory
}