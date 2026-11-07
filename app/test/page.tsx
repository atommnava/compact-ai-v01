import { extractMemories } from "@/lib/paic/extractMemories";

export default function TestPage() {
    const conversationText = `
        My name is Atom.
        I study IT and programming.
        I am building a startup project.
        I prefer detailed technical explanations.
        I want to create a portable AI identity standard.
    `;
    const extraction = extractMemories({
        text: conversationText,
    });

    return (
        <main>
            <h1>PAIC Memory Candidate Test</h1>
            <h2>Memory candidates</h2>
            <pre>
                {JSON.stringify(extraction.candidates, null, 2)}
            </pre>
        </main>
    )
}