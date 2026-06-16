import { examplePAIC } from "@/lib/paic/examplePAIC"
import { validatePAIC } from "@/lib/paic/validatePaic"
import { exportPAIC } from "@/lib/paic/exportPAIC";
import { importPAIC } from "@/lib/paic/importPAIC";
import { comparePAIC } from "@/lib/paic/comparePAIC";

export default function TestPage()
{
    const validation = validatePAIC(examplePAIC);
    const exported = exportPAIC(examplePAIC);
    const imported = importPAIC(exported);
    const comparison = comparePAIC(examplePAIC, imported);
    return (
        <main>
            <h1>PAIC Test</h1>
            
            <h2>Validación y resultado</h2>
            <pre>{JSON.stringify(validation, null, 2)}</pre>
            
            <h2>Comparando Resultado</h2>
            <pre>{JSON.stringify(comparison, null, 2)}</pre>

            <h2>Exportado PAIC</h2>
            <pre>{exported}</pre>

            <h2>Importado PAIC</h2>
            <pre>{JSON.stringify(imported, null, 2)}</pre>
        </main>
    );
}