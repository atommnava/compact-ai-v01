import { exampleConversation } from "@/lib/paic/exampleConversation";

export default function TestPage() {
    return (
        <main>
        <h1>PAIC Conversation Test</h1>
            <pre>
                {JSON.stringify(exampleConversation, null, 2)}
            </pre>
        </main> 
    );
}