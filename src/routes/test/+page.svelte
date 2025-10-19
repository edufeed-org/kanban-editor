<script lang="ts">
import { runTestSuite } from '$lib/utils/testSuite.js';
import { Button } from '$lib/components/ui/button/index.js';

let testOutput = $state('');
let isRunning = $state(false);

async function handleRunTests() {
    isRunning = true;
    testOutput = '';
    
    // Capture console output
    const originalLog = console.log;
    const originalError = console.error;
    const originalGroup = console.group;
    const originalGroupEnd = console.groupEnd;
    const originalDir = console.dir;
    
    let output = '';
    const capture = (prefix: string) => (...args: any[]) => {
        output += prefix + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ') + '\n';
    };
    
    console.log = capture('');
    console.error = capture('❌ ');
    console.group = capture('📁 ');
    console.groupEnd = () => output += '\n';
    console.dir = (obj) => output += JSON.stringify(obj, null, 2) + '\n';
    
    try {
        await runTestSuite();
    } catch (e) {
        output += '❌ Test Suite Error: ' + (e instanceof Error ? e.message : String(e)) + '\n';
    } finally {
        // Restore console
        console.log = originalLog;
        console.error = originalError;
        console.group = originalGroup;
        console.groupEnd = originalGroupEnd;
        console.dir = originalDir;
        
        testOutput = output;
        isRunning = false;
    }
}
</script>

<div class="container mx-auto p-6 max-w-4xl">
    <h1 class="text-3xl font-bold mb-6">Test Suite Runner</h1>
    
    <div class="mb-4">
        <Button onclick={handleRunTests} disabled={isRunning}>
            {isRunning ? 'Tests laufen...' : 'BoardModel Tests ausführen'}
        </Button>
    </div>
    
    {#if testOutput}
        <div class="bg-gray-100 dark:bg-gray-900 dark:text-white p-4 rounded-lg border">
            <h2 class="text-lg font-semibold mb-3">Test Ergebnisse:</h2>
            <pre class="whitespace-pre-wrap text-sm font-mono overflow-x-auto">{testOutput}</pre>
        </div>
    {/if}
</div>