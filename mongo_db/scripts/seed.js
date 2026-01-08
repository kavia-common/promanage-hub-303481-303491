// scripts/seed.js
// Run this with: mongosh "mongodb://appuser:dbuser123@localhost:5001/myapp?authSource=admin" scripts/seed.js

console.log(`Starting database seed for ${db.getName()}...`);

// 1. Users Collection
try {
    db.createCollection("users", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["email", "password_hash", "name", "createdAt"],
                properties: {
                    email: { bsonType: "string", description: "must be a string and is required" },
                    password_hash: { bsonType: "string", description: "must be a string and is required" },
                    name: { bsonType: "string", description: "must be a string and is required" },
                    createdAt: { bsonType: "date", description: "must be a date and is required" }
                }
            }
        }
    });
    console.log("Collection 'users' validated.");
} catch (e) {
    if (e.codeName === 'NamespaceExists') {
        console.log("Collection 'users' already exists.");
    } else {
        console.error(e);
    }
}
db.users.createIndex({ email: 1 }, { unique: true });

// 2. Projects Collection
try {
    db.createCollection("projects", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["name", "key", "description", "members", "createdBy", "createdAt"],
                properties: {
                    name: { bsonType: "string" },
                    key: { bsonType: "string" },
                    members: {
                        bsonType: "array",
                        items: {
                            bsonType: "object",
                            required: ["userId", "role"],
                            properties: {
                                userId: { bsonType: "objectId" },
                                role: { enum: ["admin", "member"] }
                            }
                        }
                    }
                }
            }
        }
    });
    console.log("Collection 'projects' validated.");
} catch (e) {
    if (e.codeName !== 'NamespaceExists') console.error(e);
}
db.projects.createIndex({ key: 1 }, { unique: true });

// 3. Workflow Statuses
try {
    db.createCollection("workflow_statuses", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["projectId", "name", "order"],
                properties: {
                    projectId: { bsonType: "objectId" },
                    name: { bsonType: "string" },
                    order: { bsonType: "int" }
                }
            }
        }
    });
} catch (e) { if (e.codeName !== 'NamespaceExists') console.error(e); }
db.workflow_statuses.createIndex({ projectId: 1, order: 1 });

// 4. Tasks
try {
    db.createCollection("tasks", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["projectId", "title", "statusId", "order", "createdAt"],
                properties: {
                    projectId: { bsonType: "objectId" },
                    title: { bsonType: "string" },
                    statusId: { bsonType: "objectId" },
                    assigneeId: { bsonType: ["objectId", "null"] },
                    priority: { bsonType: "string" },
                    order: { bsonType: "int" }
                }
            }
        }
    });
} catch (e) { if (e.codeName !== 'NamespaceExists') console.error(e); }
db.tasks.createIndex({ projectId: 1, order: 1 });
db.tasks.createIndex({ projectId: 1, statusId: 1 });
db.tasks.createIndex({ assigneeId: 1 });

// 5. Comments
try {
    db.createCollection("comments", {
         validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["taskId", "authorId", "body", "createdAt"],
                properties: {
                    taskId: { bsonType: "objectId" },
                    authorId: { bsonType: "objectId" },
                    body: { bsonType: "string" }
                }
            }
        }
    });
} catch (e) { if (e.codeName !== 'NamespaceExists') console.error(e); }
db.comments.createIndex({ taskId: 1, createdAt: 1 });

// 6. Activity Logs
try {
    db.createCollection("activity_logs", {
         validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["projectId", "actorId", "action", "entityType", "entityId", "createdAt"],
                properties: {
                    projectId: { bsonType: "objectId" },
                    action: { bsonType: "string" },
                    entityType: { bsonType: "string" }
                }
            }
        }
    });
} catch (e) { if (e.codeName !== 'NamespaceExists') console.error(e); }
db.activity_logs.createIndex({ projectId: 1, createdAt: -1 });

console.log("Schemas and Indexes ensured.");

// --- Seed Data ---

// Admin User
const adminEmail = "admin@example.com";
let adminUser = db.users.findOne({ email: adminEmail });
if (!adminUser) {
    try {
        const res = db.users.insertOne({
            email: adminEmail,
            password_hash: "hashed_admin_password", // Placeholder
            name: "Admin User",
            createdAt: new Date()
        });
        adminUser = db.users.findOne({ _id: res.insertedId });
        console.log("Seeded admin user.");
    } catch (e) {
        console.error("Failed to seed admin user:", e);
    }
} else {
    console.log("Admin user already exists.");
}

// Sample Project
if (adminUser) {
    const projectKey = "DEMO";
    let project = db.projects.findOne({ key: projectKey });
    if (!project) {
        try {
            const res = db.projects.insertOne({
                name: "Demo Project",
                key: projectKey,
                description: "A sample project to demonstrate capabilities.",
                createdBy: adminUser._id,
                createdAt: new Date(),
                members: [{ userId: adminUser._id, role: "admin" }]
            });
            project = db.projects.findOne({ _id: res.insertedId });
            console.log("Seeded demo project.");
        } catch(e) {
             console.error("Failed to seed project:", e);
        }
    }

    if (project) {
        // Statuses
        const statuses = [
            { name: "Backlog", order: 1 },
            { name: "In Progress", order: 2 },
            { name: "Done", order: 3 }
        ];
        const statusMap = {};

        for (const s of statuses) {
            let status = db.workflow_statuses.findOne({ projectId: project._id, name: s.name });
            if (!status) {
                const res = db.workflow_statuses.insertOne({
                    projectId: project._id,
                    name: s.name,
                    order: s.order
                });
                status = db.workflow_statuses.findOne({ _id: res.insertedId });
                console.log(`Seeded status ${s.name}`);
            }
            statusMap[s.name] = status._id;
        }

        // Tasks
        const tasks = [
            { title: "Setup Project", description: "Initial setup", status: "Done", order: 1, priority: "High" },
            { title: "Develop Features", description: "Core features", status: "In Progress", order: 1, priority: "High" },
            { title: "Testing", description: "Unit and Integration tests", status: "Backlog", order: 1, priority: "Medium" }
        ];

        for (const t of tasks) {
            let task = db.tasks.findOne({ projectId: project._id, title: t.title });
            if (!task) {
                const res = db.tasks.insertOne({
                    projectId: project._id,
                    title: t.title,
                    description: t.description,
                    statusId: statusMap[t.status],
                    assigneeId: adminUser._id,
                    priority: t.priority,
                    order: t.order,
                    dueDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // +7 days
                    createdBy: adminUser._id,
                    createdAt: new Date()
                });
                task = db.tasks.findOne({ _id: res.insertedId });
                console.log(`Seeded task ${t.title}`);
                
                // Add comment
                db.comments.insertOne({
                    taskId: task._id,
                    authorId: adminUser._id,
                    body: "Auto-generated comment for " + t.title,
                    createdAt: new Date()
                });
            }
        }

        // Activity Log
        const logCount = db.activity_logs.countDocuments({ projectId: project._id });
        if (logCount === 0) {
            db.activity_logs.insertOne({
                projectId: project._id,
                actorId: adminUser._id,
                action: "PROJECT_CREATED",
                entityType: "PROJECT",
                entityId: project._id,
                metadata: { key: project.key },
                createdAt: new Date()
            });
            console.log("Seeded activity log.");
        }
    }
}

console.log("Database seed completed successfully.");
