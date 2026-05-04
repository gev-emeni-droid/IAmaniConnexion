const API_URL = "https://direction-maj.polpo-direction.pages.dev/api";

async function testPersistence() {
    console.log("Starting Persistence Test...");

    // 1. List Templates
    console.log("1. Listing Templates...");
    const initialReq = await fetch(`${API_URL}/templates`);
    const initial = await initialReq.json();
    console.log(`Initial count: ${initial.length}`);

    // 1b. List Roles
    console.log("1b. Listing Roles...");
    const rolesReq = await fetch(`${API_URL}/roles`);
    const roles = await rolesReq.json();
    console.log("==== ROLES FOUND ====");
    roles.forEach(r => console.log(`ID: "${r.id}" | Label: "${r.label}"`));
    console.log("=====================");

    const encRole = roles.find(r => r.id.toUpperCase() === "ENCADREMENT" || (r.label && r.label.toUpperCase() === "ENCADREMENT"));
    console.log("Found ENCADREMENT Role via API:", encRole);

    if (!encRole) {
        console.warn("WARNING: ENCADREMENT role not found in API list! This might be the issue.");
    }

    // 2. Create Template for ENCADREMENT
    console.log("2. Creating Template for ENCADREMENT...");
    const targetRole = encRole ? encRole.id : "ENCADREMENT"; // Fallback if missing
    console.log(`Using Role ID: "${targetRole}"`);

    const newTpl = {
        name: "DEBUG_TEST_" + Date.now(),
        role: targetRole,
        serviceType: "midi",
        slots: [{ start: "10:00", end: "15:00" }],
        color: "#ff0000"
    };

    const createReq = await fetch(`${API_URL}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTpl)
    });
    const createRes = await createReq.json();
    console.log("Create Res:", createRes);

    if (!createRes.ok) {
        console.error("Creation FAILED!");
        return;
    }

    // 3. Verify Immediate
    console.log("3. Verifying Immedately...");
    const verifyReq = await fetch(`${API_URL}/templates`);
    const verify = await verifyReq.json();

    // Find strictly by ID match first
    const found = verify.find(t => t.name === newTpl.name);
    if (found) {
        console.log("SUCCESS: Template found immediately.");
        console.log(`Template Role: "${found.role}"`);
        console.log(`Does it match target? ${found.role === targetRole}`);
    } else {
        console.error("FAILURE: Template NOT found immediately.");
    }
}

testPersistence().catch(console.error);
