import { buildPAIC } from "@/lib/paic/buildPAIC";
import { extractMemories } from "@/lib/paic/extractMemories";
import { addExtractedMemories } from "@/lib/paic/addExtractedMemories";
import { validatePAIC } from "@/lib/paic/validatePAIC";

export default function TestPage() {
    const paic = buildPAIC({
        name: "Atom",
        occupation: "Student / Software Developer",
        education: "IT & Programming",
        languages: ["Spanish", "English"],
        location: "Mexico",
        summary:
        "Interested in AI, software development, startups, and drones.",
        interests: ["AI", "Startups", "Drones"],
    });

    const conversation = `
        My name is Atom.
        I study IT and programming.
        I am building PAIC as a startup.
        I prefer detailed technical explanations.
        I want to create a portable AI identity standard.
    `;
    
    const extraction = extractMemories({text: conversation});

    const updatedPAIC = addExtractedMemories(paic, extraction.memories);

    const validation = validatePAIC(updatedPAIC);
    return (
        <main>
            <h1>PAIC Memory Integration Test</h1>
            <h2>Extracted Memories</h2>

            <pre>
                {JSON.stringify(extraction.memories, null, 2)}
            </pre>

            <h2>Updated PAIC</h2>
            <pre>
                {JSON.stringify(updatedPAIC, null, 2)}
            </pre>

            <h2>Validation Result</h2>
            <pre>
                {JSON.stringify(validation, null, 2)}
            </pre>
        </main>
    );
}