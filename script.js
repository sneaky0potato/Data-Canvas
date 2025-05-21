document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const addTextBlockBtn = document.getElementById('addTextBlockBtn');
    const addPlotBlockBtn = document.getElementById('addPlotBlockBtn');
    const bulletinBoard = document.getElementById('bulletinBoard');
    const uploadedFilesListUl = document.querySelector('#uploadedFilesList ul');

    const boardNameInput = document.getElementById('boardNameInput');
    const saveBoardBtn = document.getElementById('saveBoardBtn');
    const createNewBoardBtn = document.getElementById('createNewBoardBtn');
    const loadBoardSelect = document.getElementById('loadBoardSelect');
    const loadBoardBtn = document.getElementById('loadBoardBtn');
    const deleteBoardBtn = document.getElementById('deleteBoardBtn');
    const currentBoardNameDisplay = document.getElementById('currentBoardNameDisplay');

    let blockIdCounter = 0;
    let uploadedData = {};

    let currentBoardName = "New Board";
    const LS_SAVED_BOARDS_LIST_KEY = 'bulletinBoard_savedBoardsList';
    const LS_BOARD_DATA_PREFIX = 'bulletinBoard_data_';

    let activeDrag = null; 
    let activeResize = null;
    let highestZIndex = 10; 
    const SNAP_TO_GRID_SIZE = 10;


    // --- Helper Functions for Notifications ---

    function showToast(message, type = 'info') {
        let backgroundColor;
        switch (type) {
            case 'success': backgroundColor = 'linear-gradient(to right, #00b09b, #96c93d)'; break;
            case 'error': backgroundColor = 'linear-gradient(to right, #ff5f6d, #ffc371)'; break;
            case 'warning': backgroundColor = 'linear-gradient(to right, #f7b733, #fc4a1a)'; break;
            default: backgroundColor = 'linear-gradient(to right, #4facfe, #00f2fe)'; break;
        }
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: backgroundColor,
            stopOnFocus: true,
        }).showToast();
    }


    // --- File Handling ---
    fileInput.addEventListener('change', handleFileUpload);

    async function handleFileUpload(event) {
        const files = event.target.files;
        if (!files.length) {
            console.log("handleFileUpload: No files selected. Exiting.");
            return;
        }

        console.log("handleFileUpload: Starting file processing.");

        try {
            for (const file of Array.from(files)) {
                console.log(`handleFileUpload: Processing file: ${file.name}`);
                const reader = new FileReader();
                try {
                    const content = await new Promise((resolve, reject) => {
                        reader.onload = (e) => {
                            console.log(`FileReader onload for ${file.name} resolved.`);
                            resolve(e.target.result);
                        };
                        reader.onerror = (err) => {
                            console.error(`FileReader onerror for ${file.name}:`, err);
                            reject(new Error(`Error reading file ${file.name}: ${reader.error}`));
                        };
                        reader.readAsText(file);
                    });

                    console.log(`handleFileUpload: Content read for ${file.name}. Attempting to parse.`);
                    const parsed = parseDatFile(content, file.name);
                    uploadedData[file.name] = parsed;
                    updateUploadedFilesList();

                    document.querySelectorAll('.plot-block-datasource-select').forEach(select => {
                        if (!Array.from(select.options).some(opt => opt.value === file.name)) {
                            const option = document.createElement('option');
                            option.value = file.name;
                            option.textContent = file.name;
                            select.appendChild(option);
                        }
                    });
                    console.log(`handleFileUpload: File ${file.name} parsed and UI updated successfully.`);
                    showToast(`${file.name} uploaded and parsed successfully!`, 'success');

                } catch (error) {
                    console.error(`handleFileUpload: Error during processing of individual file ${file.name}:`, error);
                    showToast(`Error processing ${file.name}: ${error.message}.`, 'error');
                }
            }
            console.log("handleFileUpload: All files in the loop have been processed (or attempted).");

        } catch (globalError) {
            console.error("handleFileUpload: A global error occurred during file processing:", globalError);
            showToast(`A critical error occurred during file processing: ${globalError.message}.`, 'error');
        } finally {
            console.log("handleFileUpload: Finally block executed. File input reset.");
            fileInput.value = '';
        }
    }

    function parseDatFile(content, filename = "unknown file") {
        const lines = content.trim().split(/\r?\n/);
        let headers = [];
        const rows = [];
        let headerFound = false;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                continue;
            }
            const values = trimmedLine.split(/\s+/).filter(v => v !== "");
            if (values.length === 0) continue;

            if (!headerFound) {
                headers = values;
                headerFound = true;
            } else {
                if (values.length !== headers.length && headers.length > 0) {
                    console.warn(`Skipping data line in ${filename} due to column count mismatch. Expected ${headers.length}, got ${values.length}. Line: "${trimmedLine}"`);
                    continue;
                }
                const rowData = values.map(val => {
                    const num = parseFloat(val);
                    return !isNaN(num) && isFinite(val) && val.trim() !== "" ? num : val;
                });
                rows.push(rowData);
            }
        }
        if (!headerFound && rows.length > 0) {
            headers = rows[0].map((_, i) => `Column ${i + 1}`);
            console.warn(`No explicit header found in ${filename}. Generated default headers from first data row.`);
        } else if (!headerFound && rows.length === 0) {
            throw new Error(`No parseable header or data found in ${filename}. File might be empty or only comments.`);
        } else if (headers.length === 0 && rows.length === 0) {
             throw new Error(`File ${filename} is empty or contains only unparseable data.`);
        }
        return { headers, rows };
    }

    function updateUploadedFilesList() {
        uploadedFilesListUl.innerHTML = '';
        Object.keys(uploadedData).forEach(filename => {
            const li = document.createElement('li');
            const dataInfo = uploadedData[filename] || { rows: [], headers: [] };
            li.textContent = `${filename} (${dataInfo.rows.length} rows, ${dataInfo.headers.length} cols)`;
            uploadedFilesListUl.appendChild(li);
        });
    }

    // --- Block Creation ---
    addTextBlockBtn.addEventListener('click', () => createTextBlock());
    addPlotBlockBtn.addEventListener('click', () => revisedCreatePlotBlock());

    // MODIFIED: createTextBlock for compile/edit mode
    function createTextBlock(initialConfig = {}) {
        const blockDiv = createBlockContainer('Text Block', 'text', initialConfig.style);

        let textBlockContent = initialConfig.content || '';
        let isEditingMode = initialConfig.isEditingMode !== undefined ? initialConfig.isEditingMode : true;

        const textArea = document.createElement('textarea');
        textArea.placeholder = 'Write your Markdown here... (e.g., # Heading, *italic*, [link](url), `code`)';
        textArea.value = textBlockContent;
        // Textarea styling will be managed by CSS, including font based on readonly state

        // NEW: Compile/Edit buttons
        const compileBtn = document.createElement('button');
        compileBtn.textContent = 'Render';
        compileBtn.className = 'compile-markdown-btn';
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-markdown-btn';
        
        const headerControlsDiv = blockDiv.querySelector('.header-controls');
        const removeBtn = headerControlsDiv.querySelector('.remove-btn');
        headerControlsDiv.insertBefore(compileBtn, removeBtn);
        headerControlsDiv.insertBefore(editBtn, removeBtn);


        const renderMarkdown = () => {
            if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
                textArea.value = "Error: Markdown parser or sanitizer not loaded.";
                return;
            }
            try {
                // Render HTML, sanitize, then set as textarea's innerHTML (contentEditable)
                const cleanHtml = DOMPurify.sanitize(marked.parse(textArea.value));
                textArea.innerHTML = cleanHtml; // Use innerHTML for contentEditable
                // We save raw markdown in textBlockContent, not in textarea.value
                // on render, the textarea.value IS the raw markdown.
                // After innerHTML = cleanHtml, textarea.value might become blank or non-sense,
                // so we don't update textBlockContent from textarea.value here.
                // textBlockContent is only updated when in isEditingMode.
            } catch (e) {
                textArea.value = "Error rendering Markdown. Check console for details.";
                console.error("Markdown parsing error:", e);
                showToast("Markdown rendering error. Check console.", 'error');
            }
        };

        const setMode = (editing) => {
            isEditingMode = editing;
            if (isEditingMode) {
                textArea.readOnly = false;
                textArea.contentEditable = 'true'; // Allow editing of HTML content
                textArea.value = textBlockContent; // Restore raw markdown
                compileBtn.style.display = 'inline-block';
                editBtn.style.display = 'none';
                textArea.focus();
            } else {
                textArea.readOnly = true;
                textArea.contentEditable = 'false'; // Prevent editing of rendered HTML
                // Store current raw markdown BEFORE rendering, as rendering changes textArea.innerHTML
                textBlockContent = textArea.value; 
                compileBtn.style.display = 'none';
                editBtn.style.display = 'inline-block';
                renderMarkdown(); // Render on switching to view mode
            }
            blockDiv.currentTextBlockConfig.isEditingMode = isEditingMode; // Save state
        };

        compileBtn.onclick = () => setMode(false);
        editBtn.onclick = () => setMode(true);

        blockDiv.appendChild(textArea); 


        blockDiv.currentTextBlockConfig = {
            content: textBlockContent,
            isEditingMode: isEditingMode
        };

        // Event listener for textarea content change (only when in editing mode)
        textArea.addEventListener('input', () => {
            if (isEditingMode) {
                textBlockContent = textArea.value; // Update textBlockContent only when editing
            }
        });

        // Initial setup
        setMode(isEditingMode); 
        if (textBlockContent && !isEditingMode) {
            renderMarkdown();
        } else if (textBlockContent && isEditingMode) {
            textArea.value = textBlockContent; // Ensure textarea has content if starting in edit mode
        }
        
        return blockDiv;
    }

    // --- createBlockContainer (MODIFIED for initial position, plot title editing, resizing, and drag issues) ---
    function createBlockContainer(title, type = 'text', initialConfig = {}) {
        const blockDiv = document.createElement('div');
        blockDiv.className = `block ${type}-block`;
        blockDiv.id = `block-${blockIdCounter++}`;
        blockDiv.dataset.type = type;

        // Reverted to old cascading initial position for new blocks
        let initialLeft = initialConfig.style?.left || `${(blockIdCounter % 5) * 50 + 20}px`;
        let initialTop = initialConfig.style?.top || `${Math.floor(blockIdCounter / 5) * 50 + 20}px`;
        let initialZIndex = initialConfig.style?.zIndex || highestZIndex++;
        
        blockDiv.style.left = initialLeft;
        blockDiv.style.top = initialTop;
        blockDiv.style.zIndex = initialZIndex;

        // Apply initial dimensions for text blocks or plot blocks (if loaded)
        if (initialConfig.style?.width) {
            blockDiv.style.width = initialConfig.style.width;
        }
        if (initialConfig.style?.height) {
            blockDiv.style.height = initialConfig.style.height;
        }


        const headerDiv = document.createElement('div');
        headerDiv.className = 'block-header';
        const titleEl = document.createElement('h4');
        titleEl.textContent = title;
        headerDiv.appendChild(titleEl);

        const headerControlsDiv = document.createElement('div');
        headerControlsDiv.className = 'header-controls';
        if (type === 'plot') {
            const toggleSettingsBtn = document.createElement('button');
            toggleSettingsBtn.textContent = 'Toggle Settings';
            toggleSettingsBtn.title = 'Show/Hide plot configuration controls';
            toggleSettingsBtn.onclick = () => {
                const controls = blockDiv.querySelector('.plot-controls');
                const plotContainer = blockDiv.querySelector('.plot-container');
                const config = blockDiv.currentPlotConfiguration; 
                if (controls) {
                    controls.classList.toggle('hidden');
                    if (!controls.classList.contains('hidden') && plotContainer && plotContainer.data) {
                        Plotly.Plots.resize(plotContainer.id);
                    }
                    if (config) {
                        config.settingsVisible = !controls.classList.contains('hidden');
                        blockDiv.currentPlotConfiguration = config;
                    }
                }
            };
            headerControlsDiv.appendChild(toggleSettingsBtn);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => {
            if (blockDiv.dataset.type === 'plot') {
                const plotContainer = blockDiv.querySelector('.plot-container');
                if (plotContainer && plotContainer.id) {
                     try { Plotly.purge(plotContainer.id); } catch(e) { console.warn("Error purging plot instance:", e); }
                }
            }
            blockDiv.remove();
            showToast('Block removed.', 'info');
            updateBulletinBoardHeight(); // Update height after removing a block
        };
        headerControlsDiv.appendChild(removeBtn);
        headerDiv.appendChild(headerControlsDiv);
        blockDiv.appendChild(headerDiv);

        // MODIFIED: Dragging Logic for the entire header (improved exclusions)
        headerDiv.onmousedown = (e) => {
            // Check if the click target is any interactive element *within* the header
            // This includes buttons, the resize handle (if it overlaps), or the editable title (h4).
            // `closest` checks current element and its ancestors.
            if (e.target.tagName === 'BUTTON' || e.target.closest('.resize-handle') || (e.target === titleEl && titleEl.contentEditable === 'true')) {
                return; // Do NOT start drag if clicking these elements
            }
            
            // If the click is on the header but NOT on an interactive element, start drag
            activeDrag = {
                element: blockDiv,
                offsetX: e.clientX - blockDiv.getBoundingClientRect().left,
                offsetY: e.clientY - blockDiv.getBoundingClientRect().top
            };
            blockDiv.style.zIndex = highestZIndex++;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault(); // Crucial to prevent text selection and default drag behaviors
        };
        
        bulletinBoard.appendChild(blockDiv);

        // MODIFIED: Dynamic bulletinBoard height update after block is added
        updateBulletinBoardHeight(); 

        return blockDiv;
    }

    // --- Dragging Event Handlers ---
    function onMouseMove(e) {
        if (!activeDrag) return;
        e.preventDefault();

        const boardRect = bulletinBoard.getBoundingClientRect();
        const element = activeDrag.element;
        const currentOffsetX = activeDrag.offsetX;
        const currentOffsetY = activeDrag.offsetY;

        let newX = e.clientX - boardRect.left - currentOffsetX;
        let newY = e.clientY - boardRect.top - currentOffsetY;

        // Apply snap-to-grid
        newX = Math.round(newX / SNAP_TO_GRID_SIZE) * SNAP_TO_GRID_SIZE;
        newY = Math.round(newY / SNAP_TO_GRID_SIZE) * SNAP_TO_GRID_SIZE;

        // Constrain within bulletinBoard boundaries (allowing some overflow to trigger expansion)
        newX = Math.max(0, newX); // Cannot go left of board edge
        newY = Math.max(0, newY); // Cannot go above board edge
        
        // Horizontal constraint: Cannot drag block past right edge of the board.
        newX = Math.min(newX, boardRect.width - element.offsetWidth - 20); // 20px buffer from right edge

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
        
        // MODIFIED: Update bulletinBoard height during drag
        updateBulletinBoardHeight();
    }

    function onMouseUp(e) {
        if (!activeDrag) return;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        const block = activeDrag.element;
        block.dataset.finalLeft = block.style.left;
        block.dataset.finalTop = block.style.top;
        if (block.classList.contains('text-block')) {
            block.dataset.finalWidth = block.style.width || getComputedStyle(block).width;
            block.dataset.finalHeight = block.style.height || getComputedStyle(block).height;
        } else if (block.classList.contains('plot-block')) {
             block.dataset.finalWidth = block.style.width || getComputedStyle(block).width;
             block.dataset.finalHeight = block.style.height || getComputedStyle(block).height;
        }

        activeDrag = null;
        // MODIFIED: Final height update after drag
        updateBulletinBoardHeight(); 
    }

    // --- Resizing Event Handlers for Plot Blocks ---
    function onResizeMouseMove(e) {
        if (!activeResize) return;
        e.preventDefault();

        const element = activeResize.element;
        const boardRect = bulletinBoard.getBoundingClientRect();

        let newWidth = activeResize.startWidth + (e.clientX - activeResize.startX);
        let newHeight = activeResize.startHeight + (e.clientY - activeResize.startY);

        // Apply snap-to-grid to size
        newWidth = Math.round(newWidth / SNAP_TO_GRID_SIZE) * SNAP_TO_GRID_SIZE;
        newHeight = Math.round(newHeight / SNAP_TO_GRID_SIZE) * SNAP_TO_GRID_SIZE;

        // Basic min/max width/height constraints
        const minWidth = 400; const minHeight = 450;
        const maxWidth = boardRect.width - parseInt(element.style.left) - 20; // 20px buffer from right
        const maxHeight = boardRect.height - parseInt(element.style.top) - 20; // 20px buffer from bottom

        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;

        // Tell Plotly to resize its plot
        const plotContainer = element.querySelector('.plot-container');
        if (plotContainer && plotContainer.data) { // Check if Plotly is initialized
            Plotly.Plots.resize(plotContainer.id);
        }
        // MODIFIED: Update bulletinBoard height during resize
        updateBulletinBoardHeight();
    }

    function onResizeMouseUp(e) {
        if (!activeResize) return;
        document.removeEventListener('mousemove', onResizeMouseMove);
        document.removeEventListener('mouseup', onResizeMouseUp);

        // Persist final size for plot block
        const block = activeResize.element;
        block.dataset.finalWidth = block.style.width || getComputedStyle(block).width;
        block.dataset.finalHeight = block.style.height || getComputedStyle(block).height;

        activeResize = null;
        // MODIFIED: Final height update after resize
        updateBulletinBoardHeight();
    }

    // NEW: Function to dynamically update bulletin board height
    function updateBulletinBoardHeight() {
        let maxBottom = 0;
        Array.from(bulletinBoard.children).forEach(block => {
            if (block.classList.contains('block')) {
                // Get offset and height including padding/border (offsetHeight)
                const blockBottomRelativeToBoard = block.offsetTop + block.offsetHeight;
                if (blockBottomRelativeToBoard > maxBottom) {
                    maxBottom = blockBottomRelativeToBoard;
                }
            }
        });
        const baseMinHeight = 800; // Original min-height from CSS
        const BOARD_BOTTOM_BUFFER = 100; // Additional space below the lowest block for scrolling comfort
        bulletinBoard.style.minHeight = `${Math.max(baseMinHeight, maxBottom + BOARD_BOTTOM_BUFFER)}px`;
    }


    // --- revisedCreatePlotBlock (MODIFIED: Legend default, style, plot properties) ---
    function revisedCreatePlotBlock(initialConfigWrapper = null) {
        const plotConfig = initialConfigWrapper ? initialConfigWrapper.plotConfig : null;
        const initialStyle = initialConfigWrapper ? initialConfigWrapper.style : {};

        const blockDiv = createBlockContainer('Plot Block', 'plot', { style: initialStyle, plotConfig: plotConfig }); 
        const plotSpecificIdPrefix = blockDiv.id;
        
        let plotConfiguration = {
            traces: [],
            plotTitle: `Plot for ${plotSpecificIdPrefix}`,
            xAxisTitle: "",
            yAxisTitle: "",
            settingsVisible: true, // Default to true (expanded)
            showLegend: true, // Default legend to ON
            savePngDpi: 600
        };

        if (plotConfig) {
            plotConfiguration.traces = plotConfig.traces ? JSON.parse(JSON.stringify(plotConfig.traces)) : [];
            plotConfiguration.plotTitle = plotConfig.plotTitle || plotConfiguration.plotTitle;
            plotConfiguration.xAxisTitle = plotConfig.xAxisTitle || "";
            plotConfiguration.yAxisTitle = plotConfig.yAxisTitle || "";
            plotConfiguration.settingsVisible = plotConfig.settingsVisible !== undefined ? plotConfig.settingsVisible : true;
            plotConfiguration.showLegend = plotConfig.showLegend !== undefined ? plotConfig.showLegend : true;
            plotConfiguration.savePngDpi = plotConfig.savePngDpi || 600;
        }
        blockDiv.currentPlotConfiguration = plotConfiguration;

        const plotControlsDiv = document.createElement('div');
        plotControlsDiv.className = 'plot-controls';
        if (!plotConfiguration.settingsVisible) {
            plotControlsDiv.classList.add('hidden');
        }

        function _createTraceDefinitionUI(plotControlsContainer) {
            const section = document.createElement('section');
            section.innerHTML = '<h4>Define/Edit Trace:</h4>';
            
            const dataSourceSelect = document.createElement('select'); 
            dataSourceSelect.className = 'plot-block-datasource-select';
            dataSourceSelect.innerHTML = `<option value="">-- Data Source --</option>`;
            Object.keys(uploadedData).forEach(filename => {
                const option = document.createElement('option'); option.value = filename; option.textContent = filename; dataSourceSelect.appendChild(option);
            });
            section.appendChild(dataSourceSelect);

            const xColumnSelect = document.createElement('select'); xColumnSelect.innerHTML = `<option value="">-- X Axis --</option>`; section.appendChild(xColumnSelect);
            const yColumnSelect = document.createElement('select'); yColumnSelect.innerHTML = `<option value="">-- Y Axis --</option>`; section.appendChild(yColumnSelect);
            
            dataSourceSelect.addEventListener('change', () => { 
                const selectedFile = dataSourceSelect.value;
                xColumnSelect.innerHTML = `<option value="">-- X Axis --</option>`;
                yColumnSelect.innerHTML = `<option value="">-- Y Axis --</option>`;
                if (selectedFile && uploadedData[selectedFile]) {
                    uploadedData[selectedFile].headers.forEach((header, index) => {
                        const displayText = `Col ${index + 1}: ${header}`;
                        const optionX = document.createElement('option'); optionX.value = index; optionX.textContent = displayText; xColumnSelect.appendChild(optionX);
                        const optionY = document.createElement('option'); optionY.value = index; optionY.textContent = displayText; yColumnSelect.appendChild(optionY);
                    });
                }
            });

            const plotTypeSelect = document.createElement('select'); 
            ['scatter', 'lines', 'lines+markers', 'bar'].forEach(type => {
                const option = document.createElement('option'); option.value = type; option.textContent = type.charAt(0).toUpperCase() + type.slice(1); plotTypeSelect.appendChild(option);
            });
            plotTypeSelect.value = 'scatter';
            section.appendChild(document.createTextNode(' Type: ')); section.appendChild(plotTypeSelect);
            section.appendChild(document.createElement('br')); 
            const traceLabelInput = document.createElement('input'); traceLabelInput.type = 'text'; traceLabelInput.placeholder = 'Trace Name (Legend)'; section.appendChild(traceLabelInput);
            
            const traceCustomizationGroup = document.createElement('div');
            traceCustomizationGroup.className = 'customization-group';
            traceCustomizationGroup.innerHTML = '<h5>Line Style:</h5>'; 
            traceCustomizationGroup.appendChild(document.createTextNode('Color: '));
            const lineColorInput = document.createElement('input'); lineColorInput.type = 'color'; lineColorInput.value = '#1f77b4'; traceCustomizationGroup.appendChild(lineColorInput);
            traceCustomizationGroup.appendChild(document.createTextNode(' Width: '));
            const lineWidthInput = document.createElement('input'); lineWidthInput.type = 'number'; lineWidthInput.min = '0'; lineWidthInput.value = '2'; lineWidthInput.title = "Line Width (0 for no line)"; traceCustomizationGroup.appendChild(lineWidthInput);
            traceCustomizationGroup.appendChild(document.createTextNode(' Style: '));
            const lineStyleSelect = document.createElement('select'); 
                const lineStyles = { Solid: 'solid', Dash: 'dash', Dot: 'dot', DashDot: 'dashdot', LongDash: 'longdash', LongDashDot: 'longdashdot' };
                for (const [name, value] of Object.entries(lineStyles)) {
                    const option = document.createElement('option'); option.value = value; option.textContent = name; lineStyleSelect.appendChild(option);
                }
            traceCustomizationGroup.appendChild(lineStyleSelect);
            
            const showLineCheckbox = document.createElement('input'); showLineCheckbox.type = 'checkbox'; showLineCheckbox.id = `showLine-${blockDiv.id}`; showLineCheckbox.checked = true;
            const showLineLabel = document.createElement('label'); showLineLabel.htmlFor = showLineCheckbox.id; showLineLabel.textContent = 'Show Line';
            traceCustomizationGroup.appendChild(showLineLabel); traceCustomizationGroup.appendChild(showLineCheckbox);

            traceCustomizationGroup.appendChild(document.createElement('br'));

            const markerStyleDiv = document.createElement('div');
            markerStyleDiv.className = 'marker-style-inputs';
            markerStyleDiv.innerHTML = '<h6>Marker Style:</h6>';
            markerStyleDiv.appendChild(document.createTextNode('Symbol: '));
            const markerSymbolSelect = document.createElement('select');
            const markerSymbols = ['circle', 'square', 'diamond', 'cross', 'x', 'triangle-up', 'star-square', 'hexagram', 'pentagon', 'cross-thin', 'diamond-open', 'triangle-left', 'triangle-right']; 
            markerSymbols.forEach(sym => { const opt = document.createElement('option'); opt.value = sym; opt.textContent = sym.charAt(0).toUpperCase() + sym.slice(1).replace('-', ' '); markerSymbolSelect.appendChild(opt); });
            markerStyleDiv.appendChild(markerSymbolSelect);
            markerStyleDiv.appendChild(document.createTextNode(' Size: '));
            const markerSizeInput = document.createElement('input'); markerSizeInput.type = 'number'; markerSizeInput.min = '0'; markerSizeInput.value = '6'; markerSizeInput.title = "Marker Size (0 for no marker)";
            markerStyleDiv.appendChild(markerSizeInput);

            const showMarkerCheckbox = document.createElement('input'); showMarkerCheckbox.type = 'checkbox'; showMarkerCheckbox.id = `showMarker-${blockDiv.id}`; showMarkerCheckbox.checked = true;
            const showMarkerLabel = document.createElement('label'); showMarkerLabel.htmlFor = showMarkerCheckbox.id; showMarkerLabel.textContent = 'Show Markers';
            markerStyleDiv.appendChild(showMarkerLabel); markerStyleDiv.appendChild(showMarkerCheckbox);

            traceCustomizationGroup.appendChild(markerStyleDiv);
            section.appendChild(traceCustomizationGroup); 

            const addTraceBtn = document.createElement('button'); addTraceBtn.textContent = 'Add/Update Trace'; section.appendChild(addTraceBtn);
            const newTraceBtn = document.createElement('button'); newTraceBtn.textContent = "Clear Form for New Trace"; newTraceBtn.onclick = clearTraceDefinitionForm; section.appendChild(newTraceBtn);

            plotControlsContainer.appendChild(section);

            return { dataSourceSelect, xColumnSelect, yColumnSelect, plotTypeSelect, traceLabelInput, lineColorInput, lineWidthInput, lineStyleSelect, markerSymbolSelect, markerSizeInput, addTraceBtn, markerStyleDiv, showLineCheckbox, showMarkerCheckbox };
        }

        // --- Helper for creating current traces list UI (MODIFIED for reordering) ---
        function _createCurrentTracesListUI(plotControlsContainer) {
            const section = document.createElement('section');
            section.innerHTML = '<h4>Current Traces on Plot:</h4>';
            const currentTracesListUI = document.createElement('ul');
            section.appendChild(currentTracesListUI);
            const clearTracesBtn = document.createElement('button');
            clearTracesBtn.textContent = 'Clear All Traces';
            section.appendChild(clearTracesBtn);

            const showLegendCheckbox = document.createElement('input');
            showLegendCheckbox.type = 'checkbox';
            showLegendCheckbox.id = `showLegend-${blockDiv.id}`;
            showLegendCheckbox.checked = plotConfiguration.showLegend;
            const showLegendLabel = document.createElement('label');
            showLegendLabel.htmlFor = showLegendCheckbox.id;
            showLegendLabel.textContent = 'Show Legend';
            showLegendLabel.style.marginLeft = '10px';
            section.appendChild(showLegendLabel);
            section.appendChild(showLegendCheckbox);

            plotControlsContainer.appendChild(section);
            return { currentTracesListUI, clearTracesBtn, showLegendCheckbox };
        }

        // --- Helper for creating titles UI ---
        function _createTitlesUI(plotControlsContainer) {
            const section = document.createElement('section');
            section.className = 'axis-titles-group';
            section.innerHTML = '<h4>Plot & Axis Titles:</h4>';
            
            const plotTitleInput = document.createElement('input'); plotTitleInput.type = 'text'; plotTitleInput.placeholder = 'Plot Title'; plotTitleInput.value = plotConfiguration.plotTitle;
            section.appendChild(document.createTextNode('Plot: ')); section.appendChild(plotTitleInput);
            section.appendChild(document.createElement('br'));

            const xAxisTitleInput = document.createElement('input'); xAxisTitleInput.type = 'text'; xAxisTitleInput.placeholder = 'X-Axis Title'; xAxisTitleInput.value = plotConfiguration.xAxisTitle;
            section.appendChild(document.createTextNode('X-Axis: ')); section.appendChild(xAxisTitleInput);
            
            const yAxisTitleInput = document.createElement('input'); yAxisTitleInput.type = 'text'; yAxisTitleInput.placeholder = 'Y-Axis Title'; yAxisTitleInput.value = plotConfiguration.yAxisTitle;
            section.appendChild(document.createTextNode(' Y-Axis: ')); section.appendChild(yAxisTitleInput);
            plotControlsContainer.appendChild(section);
            return { plotTitleInput, xAxisTitleInput, yAxisTitleInput };
        }

        // --- Helper for creating export UI (MODIFIED for "Fit Axes" button) ---
        function _createExportUI(plotControlsContainer) {
            const section = document.createElement('section');
            section.className = 'save-plot-group';
            section.innerHTML = '<h4>Export Plot:</h4>';
            const dpiInput = document.createElement('input'); dpiInput.type = 'number'; dpiInput.min = '72'; dpiInput.value = plotConfiguration.savePngDpi; dpiInput.id = `dpiInput-${plotSpecificIdPrefix}`;
            const savePngBtn = document.createElement('button'); savePngBtn.textContent = 'Save as PNG';
            section.appendChild(document.createTextNode('DPI: ')); section.appendChild(dpiInput);
            section.appendChild(savePngBtn);

            const fitAxesBtn = document.createElement('button');
            fitAxesBtn.textContent = 'Fit Axes';
            fitAxesBtn.title = 'Adjust axes to fit all data';
            fitAxesBtn.style.marginLeft = '10px';
            section.appendChild(fitAxesBtn); 

            plotControlsContainer.appendChild(section);
            return { dpiInput, savePngBtn, fitAxesBtn };
        }

        // --- Instantiate UI elements and their references ---
        const { dataSourceSelect, xColumnSelect, yColumnSelect, plotTypeSelect, traceLabelInput, lineColorInput, lineWidthInput, lineStyleSelect, markerSymbolSelect, markerSizeInput, addTraceBtn, markerStyleDiv, showLineCheckbox, showMarkerCheckbox } = _createTraceDefinitionUI(plotControlsDiv);
        const { currentTracesListUI, clearTracesBtn, showLegendCheckbox } = _createCurrentTracesListUI(plotControlsDiv);
        const { plotTitleInput, xAxisTitleInput, yAxisTitleInput } = _createTitlesUI(plotControlsDiv);
        const { dpiInput, savePngBtn, fitAxesBtn } = _createExportUI(plotControlsDiv);

        // Main Render Plot Button
        const actionButtonsDiv = document.createElement('div'); actionButtonsDiv.className = 'action-buttons';
        const renderPlotBtn = document.createElement('button'); renderPlotBtn.textContent = 'Render/Update Plot'; actionButtonsDiv.appendChild(renderPlotBtn);
        plotControlsDiv.appendChild(actionButtonsDiv);

        blockDiv.appendChild(plotControlsDiv);

        // Plotly Container
        const plotContainer = document.createElement('div');
        plotContainer.id = `plot-container-${plotSpecificIdPrefix}`;
        plotContainer.className = 'plot-container';
        blockDiv.appendChild(plotContainer);

        let editingTraceIndex = -1; 

        // --- Functions to manage trace definition form ---
        function populateTraceDefinitionForm(traceData) {
            dataSourceSelect.value = traceData.filename || "";
            dataSourceSelect.dispatchEvent(new Event('change')); 
            setTimeout(() => { 
                xColumnSelect.value = traceData.xColIndex !== undefined ? traceData.xColIndex.toString() : "";
                yColumnSelect.value = traceData.yColIndex !== undefined ? traceData.yColIndex.toString() : "";
            }, 50);

            plotTypeSelect.value = traceData.plotType || 'scatter';
            traceLabelInput.value = traceData.label || '';
            lineColorInput.value = traceData.style?.color || '#1f77b4';
            lineWidthInput.value = traceData.style?.width !== undefined ? traceData.style.width : '2';
            lineStyleSelect.value = traceData.style?.dash || 'solid';
            markerSymbolSelect.value = traceData.marker?.symbol || 'circle';
            markerSizeInput.value = traceData.marker?.size !== undefined ? traceData.marker.size : '6';
            
            showLineCheckbox.checked = traceData.showLine !== undefined ? traceData.showLine : true;
            showMarkerCheckbox.checked = traceData.showMarker !== undefined ? traceData.showMarker : true;

            addTraceBtn.textContent = 'Update Selected Trace';
            updateMarkerInputVisibility(); 
        }
        
        function clearTraceDefinitionForm() {
            dataSourceSelect.value = "";
            xColumnSelect.innerHTML = `<option value="">-- X Axis --</option>`;
            yColumnSelect.innerHTML = `<option value="">-- Y Axis --</option>`;
            plotTypeSelect.value = 'scatter';
            traceLabelInput.value = '';
            lineColorInput.value = '#1f77b4';
            lineWidthInput.value = '2';
            lineStyleSelect.value = 'solid';
            markerSymbolSelect.value = 'circle';
            markerSizeInput.value = '6';
            showLineCheckbox.checked = true;
            showMarkerCheckbox.checked = true;

            editingTraceIndex = -1;
            addTraceBtn.textContent = 'Add New Trace';
            updateMarkerInputVisibility();
            if (dataSourceSelect.options.length > 0) dataSourceSelect.focus();
            currentTracesListUI.querySelectorAll('.editing-trace').forEach(el => el.classList.remove('editing-trace'));
        }

        function updateMarkerInputVisibility() {
            const currentPlotType = plotTypeSelect.value;
            markerStyleDiv.style.display = (currentPlotType === 'lines' || currentPlotType === 'bar') ? 'none' : 'block';
            
            // Adjust checkboxes visibility based on plot type
            if (currentPlotType === 'lines') {
                showMarkerCheckbox.parentElement.style.display = 'none';
                showLineCheckbox.parentElement.style.display = 'inline-block';
            } else if (currentPlotType === 'scatter') {
                showLineCheckbox.parentElement.style.display = 'inline-block';
                showMarkerCheckbox.parentElement.style.display = 'inline-block';
            } else if (currentPlotType === 'lines+markers') {
                showLineCheckbox.parentElement.style.display = 'inline-block';
                showMarkerCheckbox.parentElement.style.display = 'inline-block';
            } else if (currentPlotType === 'bar') {
                showLineCheckbox.parentElement.style.display = 'none';
                showMarkerCheckbox.parentElement.style.display = 'none';
            }
        }
        plotTypeSelect.addEventListener('change', updateMarkerInputVisibility);

        function updateCurrentTracesListDisplay() {
            currentTracesListUI.innerHTML = '';
            if (plotConfiguration.traces.length === 0) {
                const li = document.createElement('li');
                li.textContent = "No traces added yet.";
                currentTracesListUI.appendChild(li);
            } else {
                plotConfiguration.traces.forEach((trace, index) => {
                    const li = document.createElement('li');
                    const traceDesc = document.createElement('span');
                    traceDesc.textContent = `${index + 1}: ${trace.label || 'Unnamed Trace'}`;
                    traceDesc.style.cursor = 'pointer';
                    traceDesc.title = 'Click to edit this trace';
                    traceDesc.onclick = () => {
                        editingTraceIndex = index;
                        populateTraceDefinitionForm(plotConfiguration.traces[index]);
                        currentTracesListUI.querySelectorAll('.editing-trace').forEach(el => el.classList.remove('editing-trace'));
                        li.classList.add('editing-trace');
                    };
                    li.appendChild(traceDesc);

                    const orderButtonsDiv = document.createElement('div');
                    const moveUpBtn = document.createElement('button');
                    moveUpBtn.textContent = '▲';
                    moveUpBtn.className = 'trace-order-btn';
                    moveUpBtn.title = 'Move up';
                    moveUpBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (index > 0) {
                            [plotConfiguration.traces[index], plotConfiguration.traces[index - 1]] = [plotConfiguration.traces[index - 1], plotConfiguration.traces[index]];
                            blockDiv.currentPlotConfiguration = plotConfiguration;
                            updateCurrentTracesListDisplay();
                            if (editingTraceIndex === index) editingTraceIndex = index - 1;
                            else if (editingTraceIndex === index - 1) editingTraceIndex = index;
                            renderPlotBtn.click();
                        }
                    };
                    const moveDownBtn = document.createElement('button');
                    moveDownBtn.textContent = '▼';
                    moveDownBtn.className = 'trace-order-btn';
                    moveDownBtn.title = 'Move down';
                    moveDownBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (index < plotConfiguration.traces.length - 1) {
                            [plotConfiguration.traces[index], plotConfiguration.traces[index + 1]] = [plotConfiguration.traces[index + 1], plotConfiguration.traces[index]];
                            blockDiv.currentPlotConfiguration = plotConfiguration;
                            updateCurrentTracesListDisplay();
                            if (editingTraceIndex === index) editingTraceIndex = index + 1;
                            else if (editingTraceIndex === index + 1) editingTraceIndex = index;
                            renderPlotBtn.click();
                        }
                    };
                    orderButtonsDiv.appendChild(moveUpBtn);
                    orderButtonsDiv.appendChild(moveDownBtn);
                    li.appendChild(orderButtonsDiv);

                    const removeTraceBtn = document.createElement('button');
                    removeTraceBtn.textContent = 'X';
                    removeTraceBtn.className = 'trace-remove-btn';
                    removeTraceBtn.title = 'Remove this trace';
                    removeTraceBtn.onclick = (e) => {
                        e.stopPropagation(); 
                        plotConfiguration.traces.splice(index, 1);
                        blockDiv.currentPlotConfiguration = plotConfiguration;
                        updateCurrentTracesListDisplay();
                        if (editingTraceIndex === index) clearTraceDefinitionForm();
                        else if (editingTraceIndex > index) editingTraceIndex--; 
                        showToast(`Trace ${index+1} removed.`, 'info');
                        renderPlotBtn.click();
                    };
                    li.appendChild(removeTraceBtn);
                    currentTracesListUI.appendChild(li);
                });
            }
            blockDiv.currentPlotConfiguration = plotConfiguration; 
        }
            
        addTraceBtn.addEventListener('click', () => {
            const filename = dataSourceSelect.value;
            const xColIndexStr = xColumnSelect.value;
            const yColIndexStr = yColumnSelect.value;
            const plotType = plotTypeSelect.value;
            let label = traceLabelInput.value.trim();

            if (!filename || xColIndexStr === "" || yColIndexStr === "") { showToast('Data source and X/Y columns are required for a trace.', 'warning'); return; }
            const fileData = uploadedData[filename];
            if (!fileData || !fileData.headers) { showToast('Data for selected file not found or has no headers.', 'error'); return; }
            const xColIndex = parseInt(xColIndexStr);
            const yColIndex = parseInt(yColIndexStr);

            if (label === "") {
                const xHeader = fileData.headers[xColIndex] !== undefined ? fileData.headers[xColIndex] : `Col ${xColIndex + 1}`;
                const yHeader = fileData.headers[yColIndex] !== undefined ? fileData.headers[yColIndex] : `Col ${yColIndex + 1}`;
                label = `${filename.split('.')[0]}: ${yHeader} vs ${xHeader}`;
            }

            const newTraceData = {
                filename, xColIndex, yColIndex, plotType, label,
                style: {
                    color: lineColorInput.value,
                    width: parseInt(lineWidthInput.value),
                    dash: lineStyleSelect.value
                },
                marker: { 
                    symbol: markerSymbolSelect.value,
                    size: parseInt(markerSizeInput.value),
                },
                showLine: showLineCheckbox.checked,
                showMarker: showMarkerCheckbox.checked
            };

            if(editingTraceIndex > -1) { 
                plotConfiguration.traces[editingTraceIndex] = newTraceData; 
                showToast(`Trace updated successfully!`, 'success');
            } else { 
                plotConfiguration.traces.push(newTraceData); 
                showToast(`Trace added successfully!`, 'success');
            }
            
            blockDiv.currentPlotConfiguration = plotConfiguration;
            updateCurrentTracesListDisplay();
            clearTraceDefinitionForm();
            renderPlotBtn.click();
        });

        clearTracesBtn.addEventListener('click', () => {
            if (plotConfiguration.traces.length > 0 && confirm("Are you sure you want to clear all traces from this plot?")) {
                plotConfiguration.traces = [];
                blockDiv.currentPlotConfiguration = plotConfiguration;
                updateCurrentTracesListDisplay();
                clearTraceDefinitionForm();
                Plotly.purge(plotContainer.id);
                showToast('All traces cleared.', 'info');
            }
        });

        showLegendCheckbox.addEventListener('change', () => {
            plotConfiguration.showLegend = showLegendCheckbox.checked;
            blockDiv.currentPlotConfiguration = plotConfiguration;
            renderPlotBtn.click();
        });


        savePngBtn.addEventListener('click', () => {
            const targetDpi = parseInt(dpiInput.value) || 600;
            plotConfiguration.savePngDpi = targetDpi; 
            blockDiv.currentPlotConfiguration = plotConfiguration;

            const plotElement = document.getElementById(plotContainer.id);
            if (!plotElement || !plotElement.layout) {
                showToast("Plot not rendered yet or error finding plot element.", 'warning');
                return;
            }
            
            const filename = (plotConfiguration.plotTitle || `plot-${plotSpecificIdPrefix}`).replace(/[^a-z0-9_]+/gi, '_').toLowerCase();

            Plotly.downloadImage(plotElement, {
                format: 'png',
                scale: targetDpi / 96, 
                filename: filename
            }).then(() => {
                showToast(`Plot saved as ${filename}.png!`, 'success');
            }).catch(err => {
                console.error("Error downloading image:", err);
                showToast(`Error downloading image: ${err.message}.`, 'error');
            });
        });

        fitAxesBtn.addEventListener('click', () => {
            const plotElement = document.getElementById(plotContainer.id);
            if (!plotElement || !plotElement.data) {
                showToast("No plot data to fit axes.", 'warning');
                return;
            }
            Plotly.relayout(plotElement, {
                'xaxis.autorange': true,
                'yaxis.autorange': true
            }).then(() => {
                showToast("Axes fitted to data.", 'info');
            }).catch(err => {
                showToast(`Error fitting axes: ${err.message}`, 'error');
                console.error("Error fitting axes:", err);
            });
            plotConfiguration.xAxisTitle = ''; 
            plotConfiguration.yAxisTitle = '';
            plotTitleInput.value = plotConfiguration.plotTitle; 
            xAxisTitleInput.value = ''; 
            yAxisTitleInput.value = '';
            blockDiv.currentPlotConfiguration = plotConfiguration;
        });

        renderPlotBtn.addEventListener('click', async () => { 
            if (plotConfiguration.traces.length === 0) { 
                showToast('No traces defined. Add at least one trace to render the plot.', 'warning');
                Plotly.purge(plotContainer.id); 
                return;
            }

            plotConfiguration.plotTitle = plotTitleInput.value.trim() || `Plot for ${plotSpecificIdPrefix}`;
            plotConfiguration.xAxisTitle = xAxisTitleInput.value.trim();
            plotConfiguration.yAxisTitle = yAxisTitleInput.value.trim();
            blockDiv.currentPlotConfiguration = plotConfiguration;

            const plotlyTraces = [];
            let autoXTitle = "", autoYTitle = "";
            let successfulTraces = 0;

            for (const traceDef of plotConfiguration.traces) {
                const data = uploadedData[traceDef.filename];
                if (!data || !data.rows || !data.headers) { 
                    console.warn(`Data for ${traceDef.filename} missing or invalid for trace ${traceDef.label}. Skipping.`);
                    showToast(`Skipping trace "${traceDef.label}": Data file not found.`, 'warning');
                    continue;
                }
                if (traceDef.xColIndex >= data.headers.length || traceDef.yColIndex >= data.headers.length || traceDef.xColIndex < 0 || traceDef.yColIndex < 0 ) { 
                    console.warn(`Invalid column index for trace ${traceDef.label} in file ${traceDef.filename}. Skipping trace.`);
                    showToast(`Skipping trace "${traceDef.label}": Invalid column selection.`, 'warning');
                    continue;
                }

                try {
                    const xValues = data.rows.map(row => row[traceDef.xColIndex]);
                    const yValues = data.rows.map(row => row[traceDef.yColIndex]);
                    
                    let currentPlotType = traceDef.plotType; 
                    let mode = ''; 

                    const traceStyle = traceDef.style || {};
                    const markerConfig = traceDef.marker || {};

                    // Determine mode based on plotType and granular checkboxes
                    if (currentPlotType === 'lines') {
                        mode = 'lines';
                    } else if (currentPlotType === 'scatter') {
                        mode = 'markers';
                    } else if (currentPlotType === 'lines+markers') {
                        if (traceDef.showLine && traceDef.showMarker) mode = 'lines+markers';
                        else if (traceDef.showLine) mode = 'lines';
                        else if (traceDef.showMarker) mode = 'markers';
                        else mode = 'none'; // Neither line nor marker
                    }
                    // Bar chart type doesn't use 'mode' property directly

                    const currentPlotlyTrace = {
                        x: xValues,
                        y: yValues,
                        type: currentPlotType === 'bar' ? 'bar' : 'scatter', 
                        mode: mode,
                        name: traceDef.label,
                        line: {
                            color: traceStyle.color,
                            width: traceStyle.width > 0 ? traceStyle.width : 0, 
                            dash: traceStyle.dash 
                        },
                        marker: {
                            color: traceStyle.color, 
                            symbol: markerConfig.symbol,
                            size: markerConfig.size > 0 ? markerConfig.size : 0, 
                        }
                    };

                    // Final adjustments before pushing to plotlyTraces
                    if (currentPlotType === 'lines') {
                        delete currentPlotlyTrace.marker; 
                    } else if (currentPlotType === 'scatter') {
                        if (!traceDef.showLine) {
                            delete currentPlotlyTrace.line;
                        }
                    } else if (currentPlotType === 'bar') {
                        delete currentPlotlyTrace.line;
                        delete currentPlotlyTrace.mode; 
                        currentPlotlyTrace.type = 'bar';
                        currentPlotlyTrace.marker = { color: traceStyle.color }; 
                    } else if (currentPlotType === 'lines+markers') {
                        if (!traceDef.showLine) {
                            delete currentPlotlyTrace.line;
                        }
                        if (!traceDef.showMarker) {
                            delete currentPlotlyTrace.marker;
                        }
                    }
                    
                    plotlyTraces.push(currentPlotlyTrace);
                    successfulTraces++;

                    if (successfulTraces === 1) { 
                        autoXTitle = data.headers[traceDef.xColIndex] || `Col ${traceDef.xColIndex + 1}`;
                        autoYTitle = data.headers[traceDef.yColIndex] || `Col ${traceDef.yColIndex + 1}`;
                    }
                } catch (err) { 
                    console.error("Error preparing trace data for Plotly:", err, traceDef);
                    showToast(`Error preparing trace "${traceDef.label}": ${err.message}.`, 'error');
                }
            }

            if (plotlyTraces.length > 0) {
                const layout = {
                    title: {
                        text: plotConfiguration.plotTitle,
                        font: { size: 16 }
                    },
                    xaxis: {
                        title: {
                            text: plotConfiguration.xAxisTitle || autoXTitle,
                            font: { size: 14 }
                        },
                        automargin: true,
                        showline: true, linewidth: 1, linecolor: 'black', mirror: true,
                        gridcolor: '#eee', tickfont: { size: 12 }
                    },
                    yaxis: {
                        title: {
                            text: plotConfiguration.yAxisTitle || autoYTitle,
                            font: { size: 14 }
                        },
                        automargin: true,
                        showline: true, linewidth: 1, linecolor: 'black', mirror: true,
                        gridcolor: '#eee', tickfont: { size: 12 }
                    },
                    margin: { l: 60, r: 30, b: 50, t: 50, pad: 4 },
                    autosize: true,
                    showlegend: plotConfiguration.showLegend,
                    legend: {
                        x: 1, y: 1,
                        xanchor: 'right', yanchor: 'top',
                        bgcolor: 'rgba(255,255,255,0.8)', bordercolor: '#ddd', borderwidth: 1,
                        font: { family: 'Arial, sans-serif', size: 12, color: '#333' }
                    },
                    template: 'plotly_white', 
                    font: { family: 'Arial, sans-serif', size: 12, color: '#333' },
                    hoverlabel: { bgcolor: "#FFF", bordercolor: "#666", font: {size: 12, color: "#333"} }
                };
                try {
                    await Plotly.react(plotContainer.id, plotlyTraces, layout, { responsive: true, displaylogo: false });
                    showToast('Plot rendered successfully!', 'success');
                } catch (plotlyError) {
                    console.error("Plotly rendering error:", plotlyError);
                    showToast(`Plot rendering failed: ${plotlyError.message}. Check console.`, 'error');
                }
            } else { 
                Plotly.purge(plotContainer.id);
                showToast("No valid traces could be rendered.", 'warning');
            }
        });

        updateCurrentTracesListDisplay(); 
        clearTraceDefinitionForm(); 
        updateMarkerInputVisibility(); 

        if (plotConfig && plotConfiguration.traces.length > 0) { 
            setTimeout(() => {
                 if (document.getElementById(plotContainer.id)) {
                     renderPlotBtn.click(); 
                 }
            }, 250); 
        }
        return blockDiv;
    }


    // --- Board Save/Load Functionality ---
    function getCurrentBoardState() {
        const blocksState = Array.from(bulletinBoard.children).map(blockDiv => {
            const type = blockDiv.dataset.type;
            const style = { 
                left: blockDiv.style.left || blockDiv.dataset.finalLeft || '20px',
                top: blockDiv.style.top || blockDiv.dataset.finalTop || '20px',
                zIndex: blockDiv.style.zIndex || '10'
            };
            if (type === 'text') {
                style.width = blockDiv.style.width || blockDiv.dataset.finalWidth || '380px';
                style.height = blockDiv.style.height || blockDiv.dataset.finalHeight || '250px';
                const textConfig = blockDiv.currentTextBlockConfig || {};
                return { 
                    type: 'text', 
                    content: textConfig.content || '',
                    isEditingMode: textConfig.isEditingMode !== undefined ? textConfig.isEditingMode : true,
                    style: style 
                };
            } else if (type === 'plot') {
                const plotConfig = blockDiv.currentPlotConfiguration || {};
                style.width = blockDiv.style.width || blockDiv.dataset.finalWidth || '650px'; 
                style.height = blockDiv.style.height || blockDiv.dataset.finalHeight || '550px';
                return { 
                    type: 'plot', 
                    plotConfig: {
                        traces: plotConfig.traces || [],
                        plotTitle: plotConfig.plotTitle || '',
                        xAxisTitle: plotConfig.xAxisTitle || '',
                        yAxisTitle: plotConfig.yAxisTitle || '',
                        settingsVisible: plotConfig.settingsVisible !== undefined ? plotConfig.settingsVisible : true,
                        showLegend: plotConfig.showLegend !== undefined ? plotConfig.showLegend : true,
                        savePngDpi: plotConfig.savePngDpi || 600
                    },
                    style: style
                };
            }
            return null;
        }).filter(b => b !== null);

        return {
            boardName: currentBoardName === "New Board" ? (boardNameInput.value.trim() || "Untitled Board") : currentBoardName,
            uploadedData: uploadedData, 
            blocks: blocksState
        };
    }

    function restoreBoardFromState(stateData) {
        if (!stateData) {
            showToast("No state data to restore.", 'error');
            return;
        }
        createNewBoard(false); 

        currentBoardName = stateData.boardName || "Untitled (Loaded)";
        boardNameInput.value = currentBoardName;
        currentBoardNameDisplay.textContent = `Current Board: ${currentBoardName}`;

        uploadedData = stateData.uploadedData || {};
        updateUploadedFilesList();
        highestZIndex = 10; 
        
        document.querySelectorAll('.plot-block-datasource-select').forEach(select => {
            select.innerHTML = `<option value="">-- Data Source --</option>`;
            Object.keys(uploadedData).forEach(filename => {
                const option = document.createElement('option');
                option.value = filename; option.textContent = filename;
                select.appendChild(option);
            });
        });

        blockIdCounter = 0; 
        (stateData.blocks || []).forEach(blockState => {
            if (blockState.style && blockState.style.zIndex) {
                const z = parseInt(blockState.style.zIndex);
                if (!isNaN(z) && z >= highestZIndex) {
                    highestZIndex = z + 1;
                }
            }

            if (blockState.type === 'text') {
                createTextBlock(blockState); 
            } else if (blockState.type === 'plot') {
                revisedCreatePlotBlock(blockState); 
            }
        });
        showToast(`Board "${currentBoardName}" loaded successfully!`, 'success');
        updateBulletinBoardHeight(); // Final update after loading all blocks
    }

    function saveCurrentBoard() {
        let boardNameToSave = boardNameInput.value.trim();
        if (!boardNameToSave) {
            if (currentBoardName !== "New Board") {
                boardNameToSave = currentBoardName;
            } else {
                boardNameToSave = prompt("Please enter a name for this board:", "My Analysis Board");
                if (!boardNameToSave) {
                    showToast("Save cancelled. Board name is required.", 'warning');
                    return;
                }
            }
        }
        
        const stateToSave = getCurrentBoardState();
        stateToSave.boardName = boardNameToSave;

        try {
            localStorage.setItem(LS_BOARD_DATA_PREFIX + boardNameToSave, JSON.stringify(stateToSave));
            let savedBoards = JSON.parse(localStorage.getItem(LS_SAVED_BOARDS_LIST_KEY)) || [];
            if (!savedBoards.includes(boardNameToSave)) {
                savedBoards.push(boardNameToSave);
                localStorage.setItem(LS_SAVED_BOARDS_LIST_KEY, JSON.stringify(savedBoards));
            }
            populateLoadBoardSelector();
            currentBoardName = boardNameToSave; 
            currentBoardNameDisplay.textContent = `Current Board: ${currentBoardName}`;
            boardNameInput.value = currentBoardName; 
            showToast(`Board "${boardNameToSave}" saved successfully!`, 'success');
        } catch (e) {
            console.error("Error saving board:", e);
            let message = `Error saving board: ${e.message}.`;
            if (e.name === 'QuotaExceededError') {
                message += ' LocalStorage might be full. Try deleting old boards or reducing data.';
            }
            showToast(message, 'error');
        }
    }

    function loadBoard() {
        const boardNameToLoad = loadBoardSelect.value;
        if (!boardNameToLoad) {
            showToast("Please select a board to load.", 'warning');
            return;
        }
        try {
            const stateString = localStorage.getItem(LS_BOARD_DATA_PREFIX + boardNameToLoad);
            if (stateString) {
                const stateData = JSON.parse(stateString);
                restoreBoardFromState(stateData);
            } else {
                showToast(`Could not find saved data for board "${boardNameToLoad}".`, 'error');
            }
        } catch (e) {
            console.error("Error loading board:", e);
            showToast(`Error loading board: ${e.message}.`, 'error');
        }
    }

    function deleteBoard() {
        const boardNameToDelete = loadBoardSelect.value;
        if (!boardNameToDelete) {
            showToast("Please select a board to delete.", 'warning');
            return;
        }
        if (confirm(`Are you sure you want to delete the board "${boardNameToDelete}"? This cannot be undone.`)) {
            localStorage.removeItem(LS_BOARD_DATA_PREFIX + boardNameToDelete);
            let savedBoards = JSON.parse(localStorage.getItem(LS_SAVED_BOARDS_LIST_KEY)) || [];
            savedBoards = savedBoards.filter(name => name !== boardNameToDelete);
            localStorage.setItem(LS_SAVED_BOARDS_LIST_KEY, JSON.stringify(savedBoards));
            populateLoadBoardSelector();
            if (currentBoardName === boardNameToDelete) {
                createNewBoard(false);
            }
            showToast(`Board "${boardNameToDelete}" deleted.`, 'success');
        }
    }

    function createNewBoard(confirmUser = true) {
        if (confirmUser && bulletinBoard.children.length > 0 && !confirm("Are you sure you want to create a new board? Unsaved changes will be lost.")) {
            return;
        }
        bulletinBoard.innerHTML = ''; 
        uploadedFilesListUl.innerHTML = ''; 
        uploadedData = {}; 
        blockIdCounter = 0; 
        highestZIndex = 10; 
        
        currentBoardName = "New Board";
        currentBoardNameDisplay.textContent = `Current Board: ${currentBoardName}`;
        boardNameInput.value = ""; 
        loadBoardSelect.value = ""; 
        document.querySelectorAll('.plot-block-datasource-select').forEach(select => {
            select.innerHTML = `<option value="">-- Data Source --</option>`;
        });
        showToast("New board created!", 'info');
        updateBulletinBoardHeight(); // Reset board height
    }

    function populateLoadBoardSelector() {
        const savedBoards = JSON.parse(localStorage.getItem(LS_SAVED_BOARDS_LIST_KEY)) || [];
        loadBoardSelect.innerHTML = '<option value="">-- Load a Saved Board --</option>'; 
        savedBoards.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            loadBoardSelect.appendChild(option);
        });
    }

    // Event Listeners for Board Management
    saveBoardBtn.addEventListener('click', saveCurrentBoard);
    loadBoardBtn.addEventListener('click', loadBoard);
    deleteBoardBtn.addEventListener('click', deleteBoard);
    createNewBoardBtn.addEventListener('click', () => createNewBoard(true));

    // Initial Setup
    populateLoadBoardSelector();
    createNewBoard(false); 

}); // End of DOMContentLoaded