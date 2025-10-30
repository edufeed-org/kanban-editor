<script lang="ts">
    import { runTestSuite } from '$lib/utils/testSuite.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import type { SvelteComponent } from 'svelte';
    
    let testOutput = $state('');
    let isRunning = $state(false);
    let testCount = $state(0);
    let testsPassed = $state(0);
    let testsFailed = $state(0);
    let groupLevel = $state(0);
    
    interface TestLine {
        text: string;
        type: 'log' | 'error' | 'group' | 'groupEnd' | 'info' | 'warn';
        level: number;
    }
    
    let testLines: TestLine[] = $state([]);
    
    async function handleRunTests() {
        isRunning = true;
        testOutput = '';
        testLines = [];
        testCount = 0;
        testsPassed = 0;
        testsFailed = 0;
        groupLevel = 0;
        
        // Capture console output with formatting
        const originalLog = console.log;
        const originalError = console.error;
        const originalGroup = console.group;
        const originalGroupEnd = console.groupEnd;
        const originalDir = console.dir;
        const originalWarn = console.warn;
        
        const addLine = (text: string, type: 'log' | 'error' | 'group' | 'groupEnd' | 'info' | 'warn') => {
            testLines.push({ text, type, level: groupLevel });
            
            // Count tests
            if (text.includes('✅')) {
                testCount++;
                testsPassed++;
            } else if (text.includes('❌')) {
                testCount++;
                testsFailed++;
            }
        };
        
        console.log = (...args: any[]) => {
            originalLog(...args);
            const text = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            addLine(text, 'log');
        };
        
        console.error = (...args: any[]) => {
            originalError(...args);
            const text = args.map(arg => String(arg)).join(' ');
            addLine(text, 'error');
        };
        
        console.warn = (...args: any[]) => {
            originalWarn(...args);
            const text = args.map(arg => String(arg)).join(' ');
            addLine(text, 'warn');
        };
        
        console.group = (label?: string) => {
            originalGroup(label);
            addLine(label || 'Group', 'group');
            groupLevel++;
        };
        
        console.groupEnd = () => {
            originalGroupEnd();
            groupLevel = Math.max(0, groupLevel - 1);
            addLine('', 'groupEnd');
        };
        
        console.dir = (obj: any) => {
            const text = JSON.stringify(obj, null, 2);
            addLine(text, 'log');
        };
        
        try {
            await runTestSuite();
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            addLine(`❌ Test Suite Error: ${errorMsg}`, 'error');
            testsFailed++;
        } finally {
            // Restore console
            console.log = originalLog;
            console.error = originalError;
            console.group = originalGroup;
            console.groupEnd = originalGroupEnd;
            console.dir = originalDir;
            console.warn = originalWarn;
            
            // Build text output
            testOutput = testLines
                .map(line => {
                    const indent = '  '.repeat(line.level);
                    if (line.type === 'groupEnd') return '';
                    return indent + line.text;
                })
                .filter(line => line.trim() !== '')
                .join('\n');
            
            isRunning = false;
        }
    }
    
    function getLineColor(line: TestLine): string {
        if (line.text.includes('✅')) return 'text-green-600';
        if (line.text.includes('❌')) return 'text-red-600';
        if (line.text.includes('⚠️')) return 'text-yellow-600';
        if (line.type === 'error') return 'text-red-500';
        if (line.type === 'warn') return 'text-yellow-600';
        if (line.type === 'group') return 'font-bold text-blue-600';
        return 'text-gray-700';
    }
</script>

<div class="min-h-screen p-6" style="background: linear-gradient(to bottom right, rgb(249, 250, 251), rgb(243, 244, 246));">
    <div class="container mx-auto max-w-5xl">
        <!-- Header -->
        <div class="mb-8">
            <h1 class="text-4xl font-bold mb-2" style="color: rgb(17, 24, 39);">🧪 Test Suite Runner</h1>
            <p style="color: rgb(75, 85, 99);">Kanban Board Model & Store Tests</p>
        </div>
        
        <!-- Status Cards -->
        <div class="grid gap-4 mb-6" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            <div class="rounded-lg shadow p-4" style="background-color: rgb(255, 255, 255);">
                <div class="text-3xl font-bold" style="color: rgb(37, 99, 235);">{testCount}</div>
                <div class="text-sm" style="color: rgb(75, 85, 99);">Tests ausgeführt</div>
            </div>
            <div class="rounded-lg shadow p-4" style="background-color: rgb(255, 255, 255);">
                <div class="text-3xl font-bold" style="color: rgb(34, 197, 94);">{testsPassed}</div>
                <div class="text-sm" style="color: rgb(75, 85, 99);">Erfolgreich</div>
            </div>
            <div class="rounded-lg shadow p-4" style="background-color: rgb(255, 255, 255);">
                <div class="text-3xl font-bold" style="color: rgb(220, 38, 38);">{testsFailed}</div>
                <div class="text-sm" style="color: rgb(75, 85, 99);">Fehlgeschlagen</div>
            </div>
        </div>
        
        <!-- Control Buttons -->
        <div class="flex gap-3 mb-6">
            <Button
                onclick={handleRunTests}
                disabled={isRunning}
                variant="default"
                size="default"
            >
                {#if isRunning}
                    <span class="inline-block animate-spin mr-2">⏳</span>
                    Tests laufen...
                {:else}
                    <span class="mr-2">▶️</span>
                    Tests ausführen
                {/if}
            </Button>
           
            <Button
                onclick={() => { testOutput = ''; testLines = []; testCount = 0; testsPassed = 0; testsFailed = 0; }}
                variant="outline"
                disabled={isRunning}
                size="default"
            >
                🗑️ Löschen
            </Button>
        </div>
        
        <!-- Test Output -->
        {#if testLines.length > 0}
            <div class="rounded-lg shadow-lg overflow-hidden border" style="background-color: rgb(255, 255, 255); border-color: rgb(229, 231, 235);">
                <div class="px-6 py-3 border-b" style="background-color: rgb(243, 244, 246); border-color: rgb(229, 231, 235);">
                    <h2 class="text-lg font-semibold" style="color: rgb(17, 24, 39);">Test Ergebnisse</h2>
                </div>
                
                <div class="p-6 max-h-96 overflow-y-auto font-mono text-sm" style="background-color: rgb(249, 250, 251);">
                    {#each testLines as line (testLines.indexOf(line))}
                        {#if line.type !== 'groupEnd'}
                            <div class="{getLineColor(line)}" style="padding-bottom: 0.125rem;">
                                <span style="padding-left: {line.level * 1.5}rem;">
                                    {line.text}
                                </span>
                            </div>
                        {/if}
                    {/each}
                </div>
                
                <!-- Footer with Summary -->
                {#if testCount > 0}
                    <div class="px-6 py-3 border-t" style="background-color: rgb(243, 244, 246); border-color: rgb(229, 231, 235);">
                        <div class="flex justify-between items-center">
                            <span style="color: rgb(55, 65, 81);">
                                <span class="font-semibold">{testCount}</span> Tests, 
                                <span class="font-semibold" style="color: rgb(34, 197, 94);">{testsPassed} ✅</span>, 
                                <span class="font-semibold" style="color: rgb(220, 38, 38);">{testsFailed} ❌</span>
                            </span>
                            {#if testsFailed === 0 && testCount > 0}
                                <span class="font-bold text-lg" style="color: rgb(34, 197, 94);">🎉 Alle Tests bestanden!</span>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        {:else if !isRunning}
            <div class="rounded-lg p-6 text-center border" style="background-color: rgb(219, 234, 254); border-color: rgb(147, 197, 253);">
                <p style="color: rgb(30, 64, 175);">
                    Klicke auf "Tests ausführen" um die Test Suite zu starten.
                </p>
            </div>
        {/if}
    </div>
</div>
