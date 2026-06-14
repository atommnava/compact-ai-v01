import { examplePAIC } from "@/lib/paic/examplePAIC"
import { validatePAIC } from "@/lib/paic/validatePaic"

export default function TestPage()
{
    const validation = validatePAIC(examplePAIC);
    return (
        <main>
            <h1>PAIC Test</h1>
            <h2>Validación</h2>
            <pre>{JSON.stringify(validation, null, 2)}</pre>
            
            <h2>PAIC Document</h2>
            <pre>{JSON.stringify(examplePAIC, null, 2)}</pre>
        </main>
    );
}