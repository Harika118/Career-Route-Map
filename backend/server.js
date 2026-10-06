const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { GoogleGenAI } = require("@google/genai");
const path = require("path");

const db = require("./database/database");

require("dotenv").config({ override: true });

const app = express();

const PORT = process.env.PORT || 5000;

const JWT_SECRET =
    process.env.JWT_SECRET || "career_route_map_secret_2026";

// =====================================================
// GEMINI AI
// =====================================================

console.log(
    "GEMINI SERVER KEY:",
    process.env.GEMINI_API_KEY
        ? process.env.GEMINI_API_KEY.slice(0, 6) + "..." + process.env.GEMINI_API_KEY.slice(-4)
        : "MISSING",
    "LENGTH:",
    process.env.GEMINI_API_KEY?.length
);

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

// =====================================================
// FRONTEND
// =====================================================

app.use(
    "/frontend",
    express.static(
        path.join(__dirname, "..", "frontend")
    )
);

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Career Route Map backend is running"
    });

});

// =====================================================
// REGISTER
// =====================================================

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

// =====================================================
// LOGIN
// =====================================================

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

            const result = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: prompt
            });

            const aiText = result.text;

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

- Education
- Branch
- Skills
- Interests
- Assessment answers
- Strengths
- Career goal
- Experience
- Career preference

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

            const result = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: prompt
            });

            const aiText = result.text;

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

// ================= ADVANCED ROADMAP SYSTEM =================

function authenticateToken(req, res, next) {

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication token required"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {

        if (err) {
            return res.status(403).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        req.user = user;
        next();
    });
}

// Create advanced product tables
db.exec(`
CREATE TABLE IF NOT EXISTS career_selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    career_title TEXT NOT NULL,
    match_percentage REAL DEFAULT 0,
    recommendation_json TEXT,
    selected_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roadmap_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    phase TEXT,
    task_title TEXT NOT NULL,
    task_description TEXT,
    priority TEXT DEFAULT 'medium',
    completed INTEGER DEFAULT 0,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    progress_percentage REAL DEFAULT 0,
    readiness_score REAL DEFAULT 0,
    last_activity TEXT
);
`);

function updateProgress(userId) {

    const result = db.prepare(`
        SELECT
            COUNT(*) AS total,
            COALESCE(
                SUM(
                    CASE
                        WHEN completed = 1 THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS completed
        FROM roadmap_tasks
        WHERE user_id = ?
    `).get(userId);

    const total = Number(result.total || 0);
    const completed = Number(result.completed || 0);

    const progressPercentage =
        total > 0
            ? Math.round((completed / total) * 100)
            : 0;

    const career = db.prepare(`
        SELECT match_percentage
        FROM career_selections
        WHERE user_id = ?
    `).get(userId);

    const matchPercentage =
        Number(career?.match_percentage || 0);

    const readinessScore = Math.round(
        (progressPercentage * 0.75) +
        (matchPercentage * 0.25)
    );

    /*
       Only update stored progress when necessary.
       This keeps roadmap loading lightweight.
    */

    db.prepare(`
        INSERT INTO user_progress
        (
            user_id,
            total_tasks,
            completed_tasks,
            progress_percentage,
            readiness_score,
            last_activity
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

        ON CONFLICT(user_id)
        DO UPDATE SET

            total_tasks = excluded.total_tasks,

            completed_tasks = excluded.completed_tasks,

            progress_percentage =
                excluded.progress_percentage,

            readiness_score =
                excluded.readiness_score
    `).run(
        userId,
        total,
        completed,
        progressPercentage,
        readinessScore
    );

    return {
        totalTasks: total,
        completedTasks: completed,
        progressPercentage,
        readinessScore
    };
}

function getProgress(userId) {

    const result = db.prepare(`
        SELECT
            COUNT(*) AS total,
            COALESCE(
                SUM(
                    CASE
                        WHEN completed = 1 THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS completed
        FROM roadmap_tasks
        WHERE user_id = ?
    `).get(userId);

    const totalTasks = Number(result.total || 0);
    const completedTasks = Number(result.completed || 0);

    const progressPercentage =
        totalTasks > 0
            ? Math.round(
                (completedTasks / totalTasks) * 100
            )
            : 0;

    const career = db.prepare(`
        SELECT match_percentage
        FROM career_selections
        WHERE user_id = ?
    `).get(userId);

    const matchPercentage =
        Number(career?.match_percentage || 0);

    const readinessScore = Math.round(
        (progressPercentage * 0.75) +
        (matchPercentage * 0.25)
    );

    return {
        totalTasks,
        completedTasks,
        progressPercentage,
        readinessScore
    };
}

// SELECT CAREER
app.post("/api/career/select", authenticateToken, (req, res) => {
    try {
        const userId = req.user.userId;
        const career = req.body.career;

        if (!career) {
            return res.status(400).json({
                success: false,
                message: "Career data required"
            });
        }

        const title =
            career.title ||
            career.careerTitle ||
            career.name ||
            "Selected Career";

        const match = Number(
            career.matchPercentage ||
            career.match_percentage ||
            career.match ||
            0
        );

        db.prepare(`
            INSERT INTO career_selections
            (user_id,career_title,match_percentage,recommendation_json)
            VALUES (?,?,?,?)
            ON CONFLICT(user_id)
            DO UPDATE SET
            career_title=excluded.career_title,
            match_percentage=excluded.match_percentage,
            recommendation_json=excluded.recommendation_json,
            selected_at=CURRENT_TIMESTAMP
        `).run(
            userId,
            title,
            match,
            JSON.stringify(career)
        );

        // Reset old roadmap
        db.prepare(`
            DELETE FROM roadmap_tasks
            WHERE user_id = ?
        `).run(userId);

// =====================================================
// CONVERT AI ROADMAP INTO CLEAN LEARNING TASKS
// =====================================================

let roadmap =
    Array.isArray(career.roadmap)
        ? career.roadmap
        : Array.isArray(career.learningPlan)
            ? career.learningPlan
            : [];

// Keep only meaningful roadmap items
roadmap = roadmap
    .map(item => {

        if (typeof item === "string") {

            return {
                title: cleanRoadmapText(item),
                description:
                    "Complete this learning milestone."
            };
        }

        if (item && typeof item === "object") {

            return {
                title: cleanRoadmapText(
                    item.title ||
                    item.task ||
                    item.name ||
                    ""
                ),

                description: cleanRoadmapText(
                    item.description ||
                    item.details ||
                    ""
                )
            };
        }

        return null;
    })
    .filter(item =>
        item &&
        item.title &&
        item.title.length > 2
    );

        const insertTask = db.prepare(`
            INSERT INTO roadmap_tasks
            (user_id,phase,task_title,task_description,priority)
            VALUES (?,?,?,?,?)
        `);

        const progress = updateProgress(userId);

        res.json({
            success: true,
            message: "Career roadmap created successfully",
            career: {
                title,
                matchPercentage: match
            },
            progress
        });

    } catch (error) {
        console.error("Career selection error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create roadmap"
        });
    }
});


// GET ROADMAP
app.get("/api/roadmap", authenticateToken, (req, res) => {
    try {

        const userId = req.user.userId;

        const career = db.prepare(`
            SELECT *
            FROM career_selections
            WHERE user_id = ?
        `).get(userId);

        if (!career) {
            return res.json({
                success: true,
                selected: false,
                tasks: [],
                career: null,
                progress: getProgress(userId)
            });
        }

        const tasks = db.prepare(`
            SELECT
            id,
            phase,
            task_title AS title,
            task_description AS description,
            priority,
            completed,
            completed_at AS completedAt
            FROM roadmap_tasks
            WHERE user_id = ?
            ORDER BY id
        `).all(userId);

        res.json({
            success: true,
            selected: true,

            career: {
                title: career.career_title,
                matchPercentage: career.match_percentage,
                recommendation: JSON.parse(
                    career.recommendation_json || "{}"
                )
            },

            tasks: tasks.map(task => ({
                ...task,
                completed: Boolean(task.completed)
            })),

            progress: updateProgress(userId)
        });

    } catch (error) {

        console.error("Roadmap error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load roadmap"
        });
    }
});


// UPDATE TASK PROGRESS
app.post("/api/progress/update", authenticateToken, (req, res) => {

    try {

        const userId = req.user.userId;
        const taskId = Number(req.body.taskId);
        const completed = Boolean(req.body.completed);

        const task = db.prepare(`
            SELECT id
            FROM roadmap_tasks
            WHERE id = ? AND user_id = ?
        `).get(taskId, userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        db.prepare(`
            UPDATE roadmap_tasks
            SET completed = ?,
                completed_at = ?
            WHERE id = ? AND user_id = ?
        `).run(
            completed ? 1 : 0,
            completed ? new Date().toISOString() : null,
            taskId,
            userId
        );

        const progress = updateProgress(userId);

        res.json({
            success: true,
            message: completed
                ? "Task completed"
                : "Task marked incomplete",
            progress
        });

    } catch (error) {

        console.error("Progress error:", error);

        res.status(500).json({
            success: false,
            message: "Progress update failed"
        });
    }
});


// ADVANCED DASHBOARD API
app.get("/api/dashboard", authenticateToken, (req, res) => {

    try {

        const userId = req.user.userId;

        const user = db.prepare(`
           SELECT id,full_name,email
            FROM users
            WHERE id = ?
        `).get(userId);

        const career = db.prepare(`
            SELECT *
            FROM career_selections
            WHERE user_id = ?
        `).get(userId);

        const progress = updateProgress(userId);

        const recentActivity = db.prepare(`
            SELECT
            phase,
            task_title AS title,
            completed,
            completed_at AS completedAt
            FROM roadmap_tasks
            WHERE user_id = ?
            AND completed = 1
            ORDER BY completed_at DESC
            LIMIT 5
        `).all(userId);

        res.json({

            success: true,

            user,

            career: career ? {
                title: career.career_title,
                matchPercentage: career.match_percentage
            } : null,

            progress,

            recentActivity
        });

    } catch (error) {

        console.error("Dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Dashboard failed"
        });
    }
});

console.log("Advanced Career Route Map system ready.");


// =====================================================
// 404 - MUST BE LAST
// =====================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found."
    });
});

// =====================================================
// START SERVER
// =====================================================

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
