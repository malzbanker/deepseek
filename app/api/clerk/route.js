// import { Webhook } from "svix";
// import connectDB from "@/config/db";
// import User from "@/models/User";
// import { headers } from "next/headers";
// import { NextRequest, NextResponse } from "next/server";

// export async function POST(req) {
//     const wh = new Webhook(process.env.SIGNING_SECRET)
//     const headerPayload = await headers()
//     const svixHeaders = {
//         "svix-id": headerPayload.get("svix-id"),
//         "svix-timestamp": headerPayload.get("svix-timestamp"),
//         "svix-signature": headerPayload.get("svix-signature"),
//     };

//     // Get the payload and verify it

//     const payload = await req.json();
//     const body = JSON.stringify(payload);
//     const { data, type } = wh.verify(body, svixHeaders);

//     // Prepare the user data to be saved in the database

//     const userData = {
//         _id: data.id,
//         email: data.email_addresses[0].email_address,
//         // email: data.email_addresses?.[0]?.email_address ?? "no-email@example.com",
//         name: `${data.first_name} ${data.last_name}`,
//         image: data.image_url,
//     };
    
//     await connectDB();

//     switch (type) {
//         case 'user.created':
//             await User.create(userData)
//             break;
        
//         case 'user.updated':
//             await User.findByIdAndUpdate(data.id, userData)
//             break;
        
//         case 'user.deleted':
//             await User.findByIdAndDelete(data.id)
//             break;
    
//         default:
//             break;
//     }

//     return NextResponse.json({message: "Event received"})
// }



import { Webhook } from "svix";
import connectDB from "@/config/db";
import User from "@/models/User";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();
        
        // Verify Svix headers
        const headerPayload = headers();
        const svixHeaders = {
            "svix-id": headerPayload.get("svix-id"),
            "svix-timestamp": headerPayload.get("svix-timestamp"),
            "svix-signature": headerPayload.get("svix-signature"),
        };

        // Check for required headers
        if (!svixHeaders["svix-id"] || !svixHeaders["svix-timestamp"] || !svixHeaders["svix-signature"]) {
            return new NextResponse("Missing required Svix headers", { status: 400 });
        }

        const payload = await req.json();
        const wh = new Webhook(process.env.SIGNING_SECRET);
        const body = JSON.stringify(payload);
        
        // Verify webhook signature
        const { data, type } = wh.verify(body, svixHeaders);

        // Prepare user data with safety checks
        const userData = {
            _id: data.id,
            email: data.email_addresses?.[0]?.email_address || "no-email@example.com",
            name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "Anonymous",
            image: data.image_url || "",
        };

        // Handle different webhook events
        switch (type) {
            case 'user.created':
                await User.create(userData);
                break;
            
            case 'user.updated':
                await User.findByIdAndUpdate(data.id, userData, { new: true, runValidators: true });
                break;
            
            case 'user.deleted':
                await User.findByIdAndDelete(data.id);
                break;

            default:
                console.warn(`Unhandled event type: ${type}`);
                return new NextResponse("Unhandled event type", { status: 200 });
        }

        return NextResponse.json({ message: "Event processed successfully" });

    } catch (error) {
        console.error("Webhook processing error:", error);
        return new NextResponse(
            JSON.stringify({ error: error.message || "Internal server error" }),
            { status: error.status || 500 }
        );
    }
}