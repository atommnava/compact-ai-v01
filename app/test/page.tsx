import { examplePAIC } from "@/lib/paic/examplePAIC"
import { validatePAIC } from "@/lib/paic/validatePaic"
import { exportPAIC } from "@/lib/paic/exportPAIC";

export default function TestPage()
{
    const validation = validatePAIC(examplePAIC);
    const exported = exportPAIC(examplePAIC);
    return (
        <main>
            <h1>PAIC Test</h1>
            <h2>Validación</h2>
            <pre>{JSON.stringify(validation, null, 2)}</pre>
            
            <h2>Exported PAIC</h2>
            <pre>{exported}</pre>
        </main>
    );
}