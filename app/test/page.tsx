import { exportPAIC } from "@/lib/paic/exportPAIC";
import { validatePAIC } from "@/lib/paic/validatePaic";
import { buildPAIC } from "@/lib/paic/buildPAIC";
import { examplePAIC } from "@/lib/paic/examplePAIC"
import { importPAIC } from "@/lib/paic/importPAIC";
import { comparePAIC } from "@/lib/paic/comparePAIC";

export default function TestPage() {
    const builtPAIC = buildPAIC({
        name: "Atom",
        occupation: "Student / Software Developer",
        education: "IT & Programming",
        languages: ["Spanish", "English"],
        location: "Mexico",
        summary: "Interested in AI, software development, startups, and drones.",
        interests: ["AI", "Startups", "Drones"],
    });
    const validation = validatePAIC(builtPAIC);
    const exported = exportPAIC(builtPAIC);
    return (
        <main>
            <h1>PAIC Builder Test</h1>

            <h2>Validation Result</h2>
            <pre>{JSON.stringify(validation, null, 2)}</pre>

            <h2>Built PAIC</h2>
            <pre>{JSON.stringify(builtPAIC, null, 2)}</pre>

            <h2>Exported PAIC</h2>
            <pre>{exported}</pre>
        </main>
    );
}