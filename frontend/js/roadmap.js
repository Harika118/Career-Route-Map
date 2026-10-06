/* =========================================================
   CAREER ROUTE MAP - ROADMAP.JS
   Professional Roadmap
   No Boss / No Character Names
   ========================================================= */

const API_BASE_URL = "http://localhost:5000";

const token = localStorage.getItem("careerRouteToken");

/* =========================================================
   AUTH CHECK
   ========================================================= */

if (!token) {
    window.location.replace("login.html");
}

/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const roadmapTasks = document.getElementById("roadmapTasks");

const careerTitle = document.getElementById("careerTitle");
const careerDescription = document.getElementById("careerDescription");

const xpValue = document.getElementById("xpValue");
const playerLevel = document.getElementById("playerLevel");
const streak = document.getElementById("streak");

const progressPercentage =
    document.getElementById("progressPercentage");

const progressFill =
    document.getElementById("progressFill");

const completedTasks =
    document.getElementById("completedTasks");

const totalTasks =
    document.getElementById("totalTasks");

const logoutButton =
    document.getElementById("logoutButton");

/* =========================================================
   GLOBAL STATE
   ========================================================= */

let roadmapData = [];
let loadingRoadmap = false;
let updatingTask = false;

/* =========================================================
   LOAD ROADMAP
   ========================================================= */

async function loadRoadmap() {

    if (loadingRoadmap) {
        return;
    }

    loadingRoadmap = true;

    if (roadmapTasks) {
        roadmapTasks.innerHTML = `
            <div class="roadmap-loading">
                <div class="loading-spinner"></div>
                <span>Loading your roadmap...</span>
            </div>
        `;
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 10000);

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/roadmap`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                signal: controller.signal
            }
        );

        clearTimeout(timeout);

        /* =================================================
           AUTH ERROR
           ================================================= */

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem("careerRouteToken");

            showMessage(
                "Session expired. Please login again.",
                "error"
            );

            setTimeout(() => {
                window.location.replace("login.html");
            }, 800);

            return;
        }

        /* =================================================
           READ RESPONSE
           ================================================= */

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                "Server returned an invalid response."
            );
        }

        /* =================================================
           SERVER ERROR
           ================================================= */

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Unable to load roadmap."
            );
        }

        /* =================================================
           CAREER INFORMATION
           ================================================= */

        if (data.career) {

            if (careerTitle) {
                careerTitle.textContent =
                    cleanText(
                        data.career.title ||
                        "Your Career Path"
                    );
            }

            if (careerDescription) {
                careerDescription.textContent =
                    cleanText(
                        data.career.description ||
                        "Your personalized learning journey."
                    );
            }
        }

        /* =================================================
           GET TASKS
           ================================================= */

        roadmapData = extractTasks(data);

        /* =================================================
           PROGRESS
           ================================================= */

        calculateLocalProgress();

        /* =================================================
           DISPLAY
           ================================================= */

        displayRoadmap(roadmapData);

    } catch (error) {

        clearTimeout(timeout);

        console.error("Roadmap error:", error);

        if (error.name === "AbortError") {

            showRoadmapError(
                "The server took too long to respond."
            );

        } else {

            showRoadmapError(
                error.message ||
                "Unable to load your roadmap."
            );
        }

    } finally {

        loadingRoadmap = false;
    }
}

/* =========================================================
   EXTRACT TASKS
   Handles different backend response formats
   ========================================================= */

function extractTasks(data) {

    if (!data) {
        return [];
    }

    if (Array.isArray(data.tasks)) {
        return data.tasks;
    }

    if (Array.isArray(data.roadmap)) {
        return data.roadmap;
    }

    if (
        data.data &&
        Array.isArray(data.data.tasks)
    ) {
        return data.data.tasks;
    }

    if (
        data.data &&
        Array.isArray(data.data.roadmap)
    ) {
        return data.data.roadmap;
    }

    return [];
}

/* =========================================================
   DISPLAY ROADMAP
   ========================================================= */

function displayRoadmap(tasks) {

    if (!roadmapTasks) {
        return;
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {

        roadmapTasks.innerHTML = `
            <div class="roadmap-message">

                <div class="empty-icon">📋</div>

                <h3>No roadmap available</h3>

                <p>
                    Complete your assessment first
                    to generate your personalized roadmap.
                </p>

                <a
                    href="dashboard.html"
                    class="retry-button"
                >
                    Go to Dashboard
                </a>

            </div>
        `;

        return;
    }

    /* =====================================================
       CLEAN ALL TASK DATA FIRST
       ===================================================== */

    const cleanedTasks = tasks
        .map(cleanTask)
        .filter(task => task.title);

    roadmapData = cleanedTasks;

    if (cleanedTasks.length === 0) {

        roadmapTasks.innerHTML = `
            <div class="roadmap-message">

                <div class="empty-icon">📋</div>

                <h3>Roadmap data needs attention</h3>

                <p>
                    The roadmap was generated, but its task
                    information could not be displayed correctly.
                </p>

            </div>
        `;

        return;
    }

    /* =====================================================
       3 TASKS = 1 STAGE
       ===================================================== */

    const stages = [];

    for (
        let i = 0;
        i < cleanedTasks.length;
        i += 3
    ) {
        stages.push(
            cleanedTasks.slice(i, i + 3)
        );
    }

    const stageNames = [
        "Programming Foundation",
        "Problem Solving",
        "Web Development",
        "Backend Development",
        "Project Development",
        "Career Preparation"
    ];

    const stageIcons = [
        "💻",
        "🧠",
        "🌐",
        "⚙️",
        "🚀",
        "🎯"
    ];

    let html = "";

    /* =====================================================
       CREATE STAGES
       ===================================================== */

    stages.forEach((stageTasks, stageIndex) => {

        const stageNumber = stageIndex + 1;

        const stageName =
            stageNames[stageIndex] ||
            `Career Stage ${stageNumber}`;

        const stageIcon =
            stageIcons[stageIndex] ||
            "📌";

        const previousStage =
            stageIndex > 0
                ? stages[stageIndex - 1]
                : null;

        const previousStageCompleted =
            stageIndex === 0 ||
            previousStage.every(
                task => isTaskCompleted(task)
            );

        const currentStageCompleted =
            stageTasks.every(
                task => isTaskCompleted(task)
            );

        const stageUnlocked =
            stageIndex === 0 ||
            previousStageCompleted;

        let stageClass = "active";

        if (currentStageCompleted) {
            stageClass = "completed";
        } else if (!stageUnlocked) {
            stageClass = "locked";
        }

        /* =================================================
           STAGE CARD
           ================================================= */

        html += `
            <div class="level-card ${stageClass}">

                <div class="level-number">
                    ${stageNumber}
                </div>

                <div class="level-icon">
                    ${stageIcon}
                </div>

                <div class="level-content">

                    <div class="level-heading">

                        <div>

                            <h3>
                                ${escapeHTML(stageName)}
                            </h3>

                            <p>
                                ${
                                    currentStageCompleted
                                        ? "Stage completed successfully."
                                        : stageUnlocked
                                            ? "Continue building your skills."
                                            : "Complete the previous stage to unlock this stage."
                                }
                            </p>

                        </div>

                        <span class="level-status ${
                            stageUnlocked
                                ? "status-open"
                                : "status-locked"
                        }">

                            ${
                                currentStageCompleted
                                    ? "✓ COMPLETED"
                                    : stageUnlocked
                                        ? "IN PROGRESS"
                                        : "LOCKED"
                            }

                        </span>

                    </div>

                    <div class="level-tasks">

                        ${stageTasks
                            .map(
                                (task, taskIndex) =>
                                    createTaskHTML(
                                        task,
                                        taskIndex,
                                        stageUnlocked
                                    )
                            )
                            .join("")
                        }

                    </div>

                </div>

            </div>
        `;

        /* =================================================
           CONNECTOR
           ================================================= */

        if (stageIndex < stages.length - 1) {

            const connectorCompleted =
                currentStageCompleted;

            html += `
                <div class="level-path ${
                    connectorCompleted
                        ? "completed"
                        : ""
                }"></div>
            `;
        }
    });

    /* =====================================================
       FINAL DESTINATION
       ===================================================== */

    const allCompleted =
        cleanedTasks.length > 0 &&
        cleanedTasks.every(
            task => isTaskCompleted(task)
        );

    html += `
        <div class="final-destination ${
            allCompleted ? "unlocked" : ""
        }">

            <div class="final-icon">
                🎯
            </div>

            <span class="quest-label">
                FINAL DESTINATION
            </span>

            <h2>
                Job Ready
            </h2>

            <p>
                ${
                    allCompleted
                        ? "Congratulations! You have completed your career roadmap."
                        : "Complete your roadmap and become ready for your next career opportunity."
                }
            </p>

            <div class="final-skills">

                <span>Technical Skills</span>
                <span>Projects</span>
                <span>Problem Solving</span>
                <span>Interview Ready</span>

            </div>

        </div>
    `;

    roadmapTasks.innerHTML = html;
}

/* =========================================================
   CLEAN TASK
   Removes markdown such as ## and ###
   ========================================================= */

function cleanTask(task) {

    if (!task || typeof task !== "object") {
        return null;
    }

    let title =
        task.title ||
        task.name ||
        task.task ||
        task.taskTitle ||
        "";

    let description =
        task.description ||
        task.details ||
        task.content ||
        "";

    let difficulty =
        task.difficulty ||
        task.priority ||
        "Recommended";

    title = cleanText(title);
    description = cleanText(description);
    difficulty = cleanText(difficulty);

    /* Remove unwanted generic AI text */

    if (
        title.toLowerCase().includes("internship at a foundry") ||
        title.toLowerCase().includes("junior analog design engineer") ||
        title.toLowerCase().includes("senior ams engineer")
    ) {

        title = "";
    }

    return {
        ...task,
        title,
        description:
            description ||
            "Complete this learning activity to continue your career journey.",
        difficulty:
            difficulty || "Recommended"
    };
}

/* =========================================================
   CLEAN TEXT
   ========================================================= */

function cleanText(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)

        /* Markdown headings */

        .replace(/^#{1,6}\s*/gm, "")

        /* Bold */

        .replace(/\*\*(.*?)\*\*/g, "$1")

        /* Italic */

        .replace(/\*(.*?)\*/g, "$1")

        /* Backticks */

        .replace(/`/g, "")

        /* Extra spaces */

        .replace(/\s+/g, " ")

        .trim();
}

/* =========================================================
   CREATE TASK HTML
   ========================================================= */

function createTaskHTML(
    task,
    taskIndex,
    stageUnlocked
) {

    const completed =
        isTaskCompleted(task);

    const taskId =
        task.id ??
        task.task_id ??
        task._id ??
        `task-${taskIndex}`;

    const title =
        cleanText(
            task.title ||
            task.name ||
            task.task ||
            `Learning Task ${taskIndex + 1}`
        );

    const description =
        cleanText(
            task.description ||
            task.details ||
            task.content ||
            "Complete this learning activity to continue your career journey."
        );

    const difficulty =
        cleanText(
            task.difficulty ||
            "Recommended"
        );

    const disabled =
        !stageUnlocked && !completed;

    return `
        <div class="quest-task ${
            completed
                ? "completed"
                : ""
        }">

            <input
                type="checkbox"
                ${completed ? "checked" : ""}
                ${disabled ? "disabled" : ""}

                onchange="
                    toggleTask(
                        '${escapeJS(taskId)}',
                        this.checked,
                        this
                    )
                "
            >

            <div class="quest-icon">
                ${
                    completed
                        ? "✓"
                        : "📘"
                }
            </div>

            <div class="task-content">

                <div class="quest-title">
                    ${escapeHTML(title)}
                </div>

                <div class="task-description">
                    ${escapeHTML(description)}
                </div>

            </div>

            <div class="quest-xp">
                +50 XP
            </div>

        </div>
    `;
}

/* =========================================================
   TASK COMPLETION
   ========================================================= */

function isTaskCompleted(task) {

    if (!task) {
        return false;
    }

    return (
        task.completed === true ||
        task.completed === 1 ||
        task.completed === "1" ||
        task.status === "completed" ||
        task.isCompleted === true
    );
}

/* =========================================================
   TOGGLE TASK
   ========================================================= */

async function toggleTask(
    taskId,
    completed,
    checkbox
) {

    if (updatingTask) {

        if (checkbox) {
            checkbox.checked = !completed;
        }

        return;
    }

    updatingTask = true;

    if (checkbox) {
        checkbox.disabled = true;
    }

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/progress/update`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({
                    taskId: taskId,
                    completed: completed
                })
            }
        );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem(
                "careerRouteToken"
            );

            window.location.replace(
                "login.html"
            );

            return;
        }

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                "Unable to update progress."
            );
        }

        /* =================================================
           UPDATE LOCAL TASK
           ================================================= */

        const task =
            roadmapData.find(
                item =>
                    String(
                        item.id ??
                        item.task_id ??
                        item._id
                    ) === String(taskId)
            );

        if (task) {

            task.completed =
                completed;

            task.status =
                completed
                    ? "completed"
                    : "pending";
        }

        /* =================================================
           UPDATE PROGRESS
           ================================================= */

        calculateLocalProgress();

        /* =================================================
           RE-RENDER
           ================================================= */

        displayRoadmap(
            roadmapData
        );

        showMessage(
            completed
                ? "Task completed successfully."
                : "Task marked as incomplete.",
            "success"
        );

    } catch (error) {

        console.error(
            "Progress update error:",
            error
        );

        if (checkbox) {
            checkbox.checked =
                !completed;
        }

        showMessage(
            error.message ||
            "Unable to update task.",
            "error"
        );

    } finally {

        updatingTask = false;

        if (checkbox) {
            checkbox.disabled = false;
        }
    }
}

/* =========================================================
   CALCULATE PROGRESS
   ========================================================= */

function calculateLocalProgress() {

    if (!Array.isArray(roadmapData)) {
        roadmapData = [];
    }

    const total =
        roadmapData.length;

    const completed =
        roadmapData.filter(
            task =>
                isTaskCompleted(task)
        ).length;

    const percentage =
        total === 0
            ? 0
            : Math.round(
                (completed / total) * 100
            );

    const xp =
        completed * 50;

    const level =
        Math.floor(xp / 250) + 1;

    updateProgress({
        completed,
        total,
        percentage,
        xp,
        level,
        streak: 1
    });
}

/* =========================================================
   UPDATE PROGRESS UI
   ========================================================= */

function updateProgress(progress) {

    const completed =
        Number(
            progress.completed ?? 0
        );

    const total =
        Number(
            progress.total ??
            roadmapData.length
        );

    const xp =
        Number(
            progress.xp ??
            completed * 50
        );

    const level =
        Number(
            progress.level ??
            Math.floor(xp / 250) + 1
        );

    const streakNumber =
        Number(
            progress.streak ?? 1
        );

    const percentage =
        total > 0
            ? Math.round(
                (completed / total) * 100
            )
            : 0;

    /* =====================================================
       HTML IDs MATCH CURRENT ROADMAP.HTML
       ===================================================== */

    if (xpValue) {
        xpValue.textContent =
            Number.isFinite(xp)
                ? xp
                : 0;
    }

    if (playerLevel) {
        playerLevel.textContent =
            Number.isFinite(level)
                ? level
                : 1;
    }

    if (streak) {
        streak.textContent =
            Number.isFinite(streakNumber)
                ? streakNumber
                : 1;
    }

    if (progressPercentage) {
        progressPercentage.textContent =
            percentage;
    }

    if (progressFill) {
        progressFill.style.width =
            percentage + "%";
    }

    if (completedTasks) {
        completedTasks.textContent =
            completed;
    }

    if (totalTasks) {
        totalTasks.textContent =
            total;
    }
}

/* =========================================================
   ERROR
   ========================================================= */

function showRoadmapError(message) {

    if (!roadmapTasks) {
        return;
    }

    roadmapTasks.innerHTML = `
        <div class="roadmap-message">

            <div class="error-icon">
                ⚠️
            </div>

            <h3>
                Unable to load your roadmap
            </h3>

            <p>
                ${escapeHTML(message)}
            </p>

            <button
                type="button"
                class="retry-button"
                onclick="loadRoadmap()"
            >
                Try Again
            </button>

        </div>
    `;
}

/* =========================================================
   TOAST
   ========================================================= */

function showMessage(
    message,
    type = "success"
) {

    const oldToast =
        document.querySelector(
            ".roadmap-toast"
        );

    if (oldToast) {
        oldToast.remove();
    }

    const toast =
        document.createElement("div");

    toast.className =
        `roadmap-toast ${type}`;

    toast.textContent =
        message;

    document.body.appendChild(
        toast
    );

    requestAnimationFrame(() => {

        toast.classList.add(
            "show"
        );

    });

    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

        setTimeout(() => {

            if (toast.parentNode) {
                toast.remove();
            }

        }, 300);

    }, 2500);
}

/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   ESCAPE JAVASCRIPT
   ========================================================= */

function escapeJS(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)

        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
}

/* =========================================================
   LOGOUT
   ========================================================= */

function logout() {

    localStorage.removeItem(
        "careerRouteToken"
    );

    localStorage.removeItem(
        "careerRouteUser"
    );

    localStorage.removeItem(
        "careerAssessment"
    );

    localStorage.removeItem(
        "careerRecommendations"
    );

    localStorage.removeItem(
        "selectedCareerPath"
    );

    window.location.replace(
        "login.html"
    );
}

/* =========================================================
   LOGOUT BUTTON
   ========================================================= */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        logout
    );
}

/* =========================================================
   START
   ========================================================= */

loadRoadmap();