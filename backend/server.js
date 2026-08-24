const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");

const db = require("./database/database");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

const JWT_SECRET =
    process.env.JWT_SECRET || "career_route_map_secret_2026";


// ========================================
// GEMINI AI
// ========================================

const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
);

const geminiModel = genAI.getGenerativeModel({
    model: "gemini-3.6-flash"
});
// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));


// ========================================
// FRONTEND
// ========================================

app.use(
    "/frontend",
    express.static(
        path.join(__dirname, "..", "frontend")
    )
);


// ========================================
// HOME
// ========================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Career Route Map backend is running"
    });

});


// ========================================
// REGISTER
// ========================================

app.post("/api/auth/register", async (req, res) => {

    try {

        const {
            fullName,
            email,
            password,
            education,
            field,
            experience,
            careerGoal,
            skills,
            interests,
            careerPreference
        } = req.body;


        if (
            !fullName ||
            !email ||
            !password ||
            !education ||
            !field ||
            !experience ||
            !skills ||
            !interests ||
            !careerPreference
        ) {

            return res.status(400).json({
                success: false,
                message: "Please fill all required fields."
            });

        }


        const existingUser = db
            .prepare(
                "SELECT id FROM users WHERE email = ?"
            )
            .get(email);


        if (existingUser) {

            return res.status(409).json({
                success: false,
                message:
                    "An account with this email already exists."
            });

        }


        const hashedPassword =
            await bcrypt.hash(password, 10);


        const insertUser = db.prepare(`

            INSERT INTO users (
                full_name,
                email,
                password,
                education,
                field_of_study,
                experience_level,
                career_goal,
                skills,
                interests,
                career_preference
            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

        `);


        const result = insertUser.run(
            fullName,
            email,
            hashedPassword,
            education,
            field,
            experience,
            careerGoal || "",
            skills,
            interests,
            careerPreference
        );


        return res.status(201).json({

            success: true,

            message:
                "Career profile created successfully.",

            userId:
                result.lastInsertRowid

        });

    }

    catch (error) {

        console.error(
            "REGISTRATION ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

});


// ========================================
// LOGIN
// ========================================

app.post("/api/auth/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required."

            });

        }


        const user = db
            .prepare(`
                SELECT *
                FROM users
                WHERE email = ?
            `)
            .get(email);


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        const token = jwt.sign(

            {
                userId: user.id,
                email: user.email
            },

            JWT_SECRET,

            {
                expiresIn: "7d"
            }

        );


        return res.status(200).json({

            success: true,

            message:
                "Login successful.",

            token,

            user: {

                id: user.id,

                fullName:
                    user.full_name,

                email:
                    user.email,

                education:
                    user.education,

                field:
                    user.field_of_study,

                experience:
                    user.experience_level,

                careerGoal:
                    user.career_goal,

                skills:
                    user.skills,

                interests:
                    user.interests,

                careerPreference:
                    user.career_preference

            }

        });

    }

    catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

});


// =====================================================
// AI — GENERATE PERSONALIZED ASSESSMENT
// =====================================================

app.post(
    "/api/ai/generate-assessment",
    async (req, res) => {

        try {

            const {
                education,
                field,
                experience,
                careerGoal,
                skills,
                interests,
                careerPreference
            } = req.body;


            if (
                !education ||
                !field ||
                !skills ||
                !interests
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Complete profile information is required."

                });

            }


            const prompt = `

You are an expert adaptive career assessment designer.

Create a personalized assessment for this specific student.

STUDENT PROFILE

Education:
${education}

Branch / Field:
${field}

Experience:
${experience || "Not specified"}

Current Skills:
${skills}

Interests:
${interests}

Career Goal:
${careerGoal || "Not specified"}

Career Preference:
${careerPreference || "Not specified"}


IMPORTANT:

This must NOT be a generic assessment.

Every question must be relevant to the student's
education, branch, skills and interests.

The questions should help determine which career
paths are most suitable for this student.

Generate EXACTLY 15 questions.

Cover:

- Technical interests
- Current skill confidence
- Problem solving
- Relevant subjects
- Work preferences
- Career motivation
- Strengths
- Learning preferences
- Career direction


Use these question types:

single_choice
multiple_choice
rating


For rating questions use a 1-5 scale.

For multiple_choice questions allow multiple answers.

Avoid duplicate questions.

Return ONLY valid JSON.

Use exactly this structure:

{
    "assessmentTitle": "",
    "instructions": "",
    "questions": [
        {
            "id": 1,
            "question": "",
            "type": "single_choice",
            "options": []
        }
    ]
}

The questions array MUST contain exactly 15 questions.

`;


const result = await geminiModel.generateContent(prompt);

const aiText =
    result.response.text();


            let assessment;


            try {

                assessment =
                    JSON.parse(aiText);

            }

            catch (error) {

                console.error(
                    "INVALID AI ASSESSMENT:",
                    aiText
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "AI returned invalid assessment data."

                });

            }


            return res.status(200).json({

                success: true,

                assessment

            });

        }

        catch (error) {

            console.error(
                "AI ASSESSMENT ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// =====================================================
// AI — GENERATE CAREER RECOMMENDATIONS
// =====================================================

app.post(
    "/api/ai/recommendations",
    async (req, res) => {

        try {

            const {
                education,
                field,
                experience,
                careerGoal,
                skills,
                interests,
                careerPreference,
                assessment,
                answers
            } = req.body;


            if (
                !education ||
                !field ||
                !skills ||
                !interests
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Complete profile information is required."

                });

            }


            const prompt = `

You are an expert AI career recommendation system.

Analyze this student's complete profile AND
personalized assessment answers.

EDUCATION:
${education}

BRANCH:
${field}

EXPERIENCE:
${experience || "Not specified"}

CAREER GOAL:
${careerGoal || "Not specified"}

CURRENT SKILLS:
${skills}

INTERESTS:
${interests}

CAREER PREFERENCE:
${careerPreference || "Not specified"}

ASSESSMENT:
${JSON.stringify(assessment || {})}

STUDENT ANSWERS:
${JSON.stringify(answers || {})}


Generate EXACTLY 4 career paths.

Rank them from highest suitability to lowest suitability.

The recommendation must consider:

Education
Branch
Skills
Interests
Assessment answers
Strengths
Career goal
Experience
Career preference


Do NOT simply recommend popular careers.

Each path must explain why it matches this
specific student.

For every career provide:

- Career title
- Match percentage
- Reason
- Required skills
- Missing skills
- Learning plan
- Roadmap
- Projects
- Job roles
- Growth potential


Return ONLY valid JSON.

Use exactly:

{
    "careerPaths": [
        {
            "title": "",
            "matchPercentage": 0,
            "reason": "",
            "requiredSkills": [],
            "missingSkills": [],
            "learningPlan": [],
            "roadmap": [],
            "projects": [],
            "jobRoles": [],
            "growthPotential": ""
        }
    ]
}

`;


const result = await geminiModel.generateContent(prompt);

const aiText =
    result.response.text();


            let recommendations;


            try {

                recommendations =
                    JSON.parse(aiText);

            }

            catch (error) {

                console.error(
                    "INVALID AI RECOMMENDATIONS:",
                    aiText
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "AI returned invalid recommendation data."

                });

            }


            return res.status(200).json({

                success: true,

                recommendations

            });

        }

        catch (error) {

            console.error(
                "AI RECOMMENDATION ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ========================================
// 404
// ========================================

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message:
            "API route not found."

    });

});


// ========================================
// START SERVER
// ========================================

app.listen(
    PORT,
    () => {

        console.log(
            "========================================"
        );

        console.log(
            `Career Route Map server running on http://localhost:${PORT}`
        );

        console.log(
            "AI dynamic assessment system ready."
        );

        console.log(
            "AI career recommendation system ready."
        );

        console.log(
            "========================================"
        );

    }
);