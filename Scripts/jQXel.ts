﻿
class ThemeOptions {
    constructor(color: string, style: string) {
        this.color = color;
        this.style = style;
    }

    public color: string;
    public style: string;
}

class ToolbarOptions {
    constructor(add: boolean, copy: boolean, insert: boolean, includeRowNumbers: boolean, position: string) {
        this.add = add;
        this.copy = copy;
        this.insert = insert;
        this.position = position;
        this.includeRowNumbers = includeRowNumbers;
    }

    public add: boolean;
    public copy: boolean;
    public insert: boolean;
    public position: string;
    public includeRowNumbers: boolean;
}

class JSONHeader {
    constructor(text: string, editable: string, type: string, name: string, options: Array<HTMLOptionElement>) {
        this.text = text;
        this.editable = editable;
        this.type = type;
        this.options = options;
        this.name = name;
    }

    public text: string;
    public editable: string;
    public type: string;
    public name: string;
    public options: Array<HTMLOptionElement>;
}

class JSONData {
    constructor(text: string, value: string, editable: string, name: string, entityId: number, href?: string) {
        this.text = text;
        this.value = value;
        this.editable = editable;
        this.name = name;
        this.entityId = entityId;
        if (href) {
            this.href = href;
        }
    }

    public text: string;
    public value: string;
    public editable: string;
    public entityId: number;
    public name: string;
    public href: string;
}
class JSONTable {
    private data: Array<Array<JSONData>>;
    private table: HTMLDivElement;
    private toolbar: HTMLDivElement;
    private toolbarOptions: ToolbarOptions;
    private themeOptions: ThemeOptions;
    private container: HTMLDivElement;
    private miniToolbar: HTMLDivElement;

    public headers: Array<JSONHeader>;
    public footer: Array<JSONData>;
    public selectedCell: SelectedCell;
    public highlightedRows: Array<Array<JSONData>>;

    constructor(data: Array<Array<JSONData>>, headers: Array<JSONHeader>, footer: Array<JSONData>, containerID: string, beforeCellChange: Function, beforeColumnChange: Function, beforeRowChange: Function, onCopy: Function, onjQXlReady: Function, toolbarOptions: ToolbarOptions, themeOptions: ThemeOptions) {
        var rowCallbacks = $.Callbacks(),
            colCallbacks = $.Callbacks(),
            copyCallbacks = $.Callbacks(),
            readyCallbacks = $.Callbacks(),
            cellCallbacks = $.Callbacks();
        this.data = data;
        this.headers = headers;
        this.footer = footer;
        this.themeOptions = themeOptions;
        this.toolbarOptions = toolbarOptions;
        this.buildTable();
        this.toolbar = this.buildToolbar(toolbarOptions);
        this.container = this.buildContainer(themeOptions);
        var context: JSONTable = this;
        // make sure the cell change event is fired if user clicks outside the bounds of the table
        $(document).on('click', function (e: Event) {
            if (!$(e.target).closest('#' + containerID).length) {
                context.container.dispatchEvent(new Event('beforecellchange'));
            }
        });
        if (onCopy.length) {
            copyCallbacks.add(onCopy);
            context.container.addEventListener('copy', function (e: ClipboardEvent) {
                if (e.clipboardData) {
                    e.clipboardData.setData('text/plain', context.getClipboardText());
                    copyCallbacks.fire(e, context.highlightedRows);
                }
            });
        }
        if (beforeRowChange.length) {
            rowCallbacks.add(beforeRowChange);
            context.container.addEventListener('beforerowchange', function (e: Event) {
                var index = context.selectedCell.getRowIndex();
                var rowData = context.returnRow(index);
                rowCallbacks.fire(rowData, context.selectedCell);
            });
        }
        if (beforeColumnChange.length) {
            colCallbacks.add(beforeColumnChange);
            context.container.addEventListener('beforecolumnchange', function (e: Event) {
                var index: number = parseInt(context.selectedCell.cell.dataset['index']);
                if (index > -1) {
                    colCallbacks.fire(context.returnColumn(index), context.selectedCell);
                }
            });
        }
        if (beforeCellChange.length) {
            cellCallbacks.add(beforeCellChange);
            context.container.addEventListener('beforecellchange', function (e: Event) {
                if (context.selectedCell) {
                    context.bindNavigation(context.selectedCell.cell);
                    cellCallbacks.fire(context.selectedCell);
                }

            });
        }
        if (onjQXlReady.length) {
            readyCallbacks.add(onjQXlReady);
            context.container.addEventListener('jqxlready', function (e: Event) {
                readyCallbacks.fire(e, context);
            });
        }
        var container: HTMLElement = document.getElementById(containerID);
        container.appendChild(this.container);
    }

    private setItemValue(rowIndex: number, cellIndex: number, text: string): void {
        this.data[rowIndex][cellIndex].text = text;
    }
    private bindFocus(cell: HTMLDivElement) {
        var context: JSONTable = this;
        cell.onfocus = function (e: Event) {
            context.select(cell);
            cell.onblur = function (be: Event) {
                context.clearSelected();
            };
        };
    }
    private bindNavigation(cell: HTMLDivElement) {
        var context: JSONTable = this;
        cell.onkeydown = function (e: KeyboardEvent) {
            switch (e.which) {
                case 9: { // tab
                    e.preventDefault();
                    context.moveRight();
                } break;
                case 37: { // left
                    e.preventDefault();
                    context.moveLeft();
                } break;
                case 38: { // up
                    e.preventDefault();
                    context.moveUp();
                } break;
                case 39: { // right
                    e.preventDefault();
                    context.moveRight();
                } break;
                case 40: { // down
                    e.preventDefault();
                    context.moveDown();
                } break;
                default: {
                    var index = parseInt(cell.dataset['index']);
                    var header = context.headers[index];
                    if (header.type !== 'text') {
                        e.preventDefault();
                    }
                } break;
            }
        };
    }
    private createNewDataRow(): Array<JSONData> {
        var count: number = this.headers ? this.headers.length : 0,
            dataRow: Array<JSONData> = new Array<JSONData>();
        for (var i = 0; i < count; i++) {
            dataRow.push(new JSONData(' ', ' ', 'True', this.headers[i].name, 0)); // when columns have editable options, check header data
        }
        return dataRow;
    }
    private populateNewRow(row: HTMLDivElement, rowData: Array<JSONData>): HTMLDivElement {
        var colCount: number = this.headers.length;
        var hdrCell: HTMLDivElement = this.createRowHeaderCell(row.dataset['rowIndex']);
        row.appendChild(hdrCell);
        var cell: HTMLDivElement;
        for (var i = 0; i < colCount; i++) {
            cell = this.createCell(rowData[i], i, this.headers[i].type);
            row.appendChild(cell);
        }
        return row;
    }
    private createMiniToolbar(index: number): HTMLUListElement {
        var miniToolbar: HTMLUListElement = document.createElement('ul'),
            context: JSONTable = this;
        if (context.toolbarOptions) {
            miniToolbar.classList.add('jql-mini-tlbr');
            miniToolbar.id = 'jqlMnTlbr' + index.toString();
            if (context.toolbarOptions.copy) {
                var li = context.createMiniToolbarItem(index, 'copy');
                miniToolbar.appendChild(li);
            }
            if (context.toolbarOptions.insert) {
                var li = context.createMiniToolbarItem(index, 'insert');
                miniToolbar.appendChild(li);
            }
        } else {
            miniToolbar.style.display = 'none';
        }
        return miniToolbar;
    }
    private createMiniToolbarItem(rowIndex: number, buttonType: string): HTMLLIElement {
        var context = this;
        var item: HTMLLIElement = document.createElement('li'),
            button: HTMLInputElement = document.createElement('input');
        button.type = 'button';
        button.classList.add('jql-mini-tlbr-btn');
        switch (buttonType) {
            case 'insert': {
                button.title = 'Insert After';
                button.classList.add('jql-mini-insrt-btn');
                button.onmousedown = function (e: MouseEvent) {
                    e.preventDefault();
                    e.stopPropagation();
                    context.insertRowAfter(rowIndex);
                    return false;
                };
            };
                break;
            case 'copy': {
                button.title = 'Copy to Clipboard';
                button.classList.add('jql-mini-cpy-btn');
                button.onmousedown = function (e: MouseEvent) {
                    context.highlightedRows = new Array<Array<JSONData>>(context.data[rowIndex]);
                    context.copyToClipboard();
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                };
            };
                break;
        }

        item.appendChild(button);
        return item;
    }
    private findPos(obj) {
        var curtop = 0;
        if (obj.offsetParent) {
            do {
                curtop += obj.offsetTop;
            } while (obj = obj.offsetParent);
            return curtop;
        }
    }
    private insertRowAfter(rowIndex: number): void {
        var rows: NodeListOf<HTMLDivElement> = <NodeListOf<HTMLDivElement>>this.table.getElementsByClassName('jql-tbl-rw');
        console.log(rowIndex);
        var newRow = this.createRow(false, false, rowIndex + 1),
            dataRow = this.createNewDataRow(),
            context = this;
        newRow = context.populateNewRow(newRow, dataRow);
        context.data.splice(rowIndex, 0, dataRow).join();
        console.log(context.data);
        newRow.style.display = 'none';
        $(newRow).insertAfter(rows[rowIndex]);
        this.refreshRowHeaders();
        $(newRow).slideDown(100);

    }
    private refreshRowHeaders(): void {
        if (this.data && this.data.length > 0) {
            var rowCount: number = this.data.length,
                rows: NodeListOf<HTMLDivElement> = <NodeListOf<HTMLDivElement>>this.table.getElementsByClassName('jql-tbl-rw'),
                cell: HTMLDivElement;
            for (var i = 1; i <= rowCount; i++) {
                rows[i - 1].dataset['rowIndex'] = (i - 1).toString();
                cell = <HTMLDivElement>rows[i - 1].getElementsByClassName('jql-tbl-rw-hdr-cll')[0];
                $(cell).replaceWith(this.createRowHeaderCell(i.toString()));
            }
        }
    }

    private buildContainer(themeOptions: ThemeOptions): HTMLDivElement {
        this.themeOptions = themeOptions;
        var context = this;
        var container: HTMLDivElement = document.createElement('div'),
            innerTable: HTMLDivElement = document.createElement('div'),
            innerCol1: HTMLDivElement = document.createElement('div'),
            innerCol2: HTMLDivElement = document.createElement('div');
        innerTable.classList.add('jql-table');
        innerCol1.classList.add('jql-column');
        innerCol2.classList.add('jql-column');
        container.classList.add('jql-container');
        if (themeOptions) {
            if (themeOptions.style) {
                container.classList.add('jql-' + themeOptions.style);
            }
            if (themeOptions.color) {
                switch (themeOptions.color) {
                    case 'blue':
                    case 'blu': {
                        container.classList.add('jql-blu');
                    } break;
                    case 'grn':
                    case 'green': {
                        container.classList.add('jql-grn');
                    } break;
                    default: {
                        container.classList.add('jql-' + themeOptions.color);
                    } break;
                }
            }
        }

        if (context.toolbarOptions) {
            switch (context.toolbarOptions.position) {
                case 'top': {
                    var row: HTMLDivElement = document.createElement('div');
                    row.classList.add('jql-row');
                    row.appendChild(context.toolbar);
                    container.appendChild(row);

                    var row2: HTMLDivElement = document.createElement('div');
                    row2.classList.add('jql-row');
                    row2.appendChild(context.table);
                    container.appendChild(row2);
                } break;
                case 'bottom': {
                    var row: HTMLDivElement = document.createElement('div');
                    row.classList.add('jql-row');
                    row.appendChild(context.table);
                    container.appendChild(row);

                    var row2: HTMLDivElement = document.createElement('div');
                    row2.classList.add('jql-row');
                    row2.appendChild(context.toolbar);
                    container.appendChild(row2);
                } break;
                case 'left': {
                    var column: HTMLDivElement = document.createElement('div');
                    column.classList.add('jql-column');
                    column.appendChild(context.toolbar);
                    container.appendChild(column);

                    var column2: HTMLDivElement = document.createElement('div');
                    column2.classList.add('jql-column');
                    column2.appendChild(context.table);
                    container.appendChild(column2);

                } break;
                case 'right': {
                    var column: HTMLDivElement = document.createElement('div');
                    column.classList.add('jql-column');
                    column.appendChild(context.table);
                    container.appendChild(column);

                    var column2: HTMLDivElement = document.createElement('div');
                    column2.classList.add('jql-column');
                    column2.appendChild(context.toolbar);
                    container.appendChild(column2);
                } break;
            }
        }
        else {
            container.appendChild(this.table);
        }
        document.dispatchEvent(new Event('jqxlready'));
        return container;
    }
    private buildTable(): void {
        var context = this;
        var table: HTMLDivElement = document.createElement('div');
        if (context.headers) {
            var row: HTMLDivElement = context.createRow(true, false, 0);
            if (context.toolbarOptions.includeRowNumbers) {
                row.appendChild(context.createRowHeaderCell(''));
            }
            for (var i = 0; i < context.headers.length; i++) {
                var cell: HTMLDivElement = document.createElement('div');
                cell.classList.add('jql-tbl-hdr-cll');
                cell.classList.add('jql-btn');
                cell.textContent = context.headers[i].text;
                row.appendChild(cell);
            }
            table.appendChild(row);
        }
        if (context.data) {
            table.classList.add('jql-tbl');
            var miniTlbrTbl = document.createElement('div');
            miniTlbrTbl.classList.add('jql-mn-tlbr-tbl');
            for (var y = 0, length = context.data.length; y < length; y++) {
                var row: HTMLDivElement = context.createRow(false, false, y + 1);
                if (context.toolbarOptions.includeRowNumbers) {
                    row.appendChild(context.createRowHeaderCell((y + 1).toString()));
                }
                for (var x = 0, xLength = context.data[y].length; x < xLength; x++) {
                    row.appendChild(context.createCell(context.data[y][x], x, context.headers[x].type));
                }
                table.appendChild(row);
                miniTlbrTbl.appendChild(context.createMiniToolbar(y + 1));
            }
            this.miniToolbar = miniTlbrTbl;
        }
        if (context.footer) {
            var row: HTMLDivElement = context.createRow(false, true, context.data != null ? context.data.length + 1 : 9999);
            for (var i = 0; i < context.footer.length; i++) {
                var cell: HTMLDivElement = document.createElement('div');
                cell.classList.add('jql-tbl-ftr-cll');
                cell.textContent = context.footer[i].text == '' ? ' ' : context.footer[i].text;
                row.appendChild(cell);
            }
            table.appendChild(row);
        }
        this.table = table;

    }
    public getClipboardText(): string {
        var selectedText: string = '',
            context = this;
        var rows: Array<Array<JSONData>> = context.highlightedRows;
        if (rows && rows.length > 0) {
            for (var i = 0, length = rows.length; i < length; i++) {
                for (var x = 0, rowLength = rows[i].length; x < rowLength; x++) {
                    selectedText += (rows[i][x].text == null ? '' : rows[i][x].text + '\t');
                }
                selectedText += '\n';
            }
        }
        return selectedText;
    }
    public appendRow(): void {
        var rowIndex: number = (this.data.length + 1);
        var colCount: number = this.headers.length,
            row: HTMLDivElement = this.createRow(false, false, rowIndex);
        var rowData: Array<JSONData> = this.createNewDataRow();
        row = this.populateNewRow(row, rowData);
        this.data.push(rowData);
        this.table.appendChild(row);
        window.scrollTo(0, this.findPos(row));
    }
    public copyToClipboard(): void {
        document.execCommand('copy');
        document.dispatchEvent(new ClipboardEvent('copy', { dataType: 'text/plain', data: this.getClipboardText() }));
    }
    private buildToolbar(toolbarOptions: ToolbarOptions): HTMLDivElement {
        var toolbar: HTMLDivElement = document.createElement('div'),
            ul: HTMLUListElement = document.createElement('ul'),
            context: JSONTable = this;
        this.toolbarOptions = toolbarOptions;
        toolbar.classList.add('jql-tlbr');
        toolbar.classList.add('jql-tlbr-' + toolbarOptions.position);
        ul.classList.add('jql-tlbr-lst');
        if (toolbarOptions.add) {
            var li = document.createElement('li'),
                addBtn = document.createElement('button');
            addBtn.classList.add('jql-tlbr-btn');
            addBtn.classList.add('jql-btn');
            addBtn.id = 'jqlAddBtn';
            addBtn.textContent = 'Add Row';
            addBtn.onclick = function (e: MouseEvent) {
                context.appendRow();
            };
            li.appendChild(addBtn);
            ul.appendChild(li);
        }
        if (toolbarOptions.copy) {
            var li = document.createElement('li'),
                copyBtn = document.createElement('button');
            copyBtn.classList.add('jql-tlbr-btn');
            copyBtn.classList.add('jql-btn');
            copyBtn.id = 'jqlCopyBtn';
            copyBtn.textContent = 'Copy';
            copyBtn.onclick = function (e: MouseEvent) {
                console.log('click');
                context.copyToClipboard();
            };
            li.appendChild(copyBtn);
            ul.appendChild(li);
        }
        toolbar.appendChild(ul);
        return toolbar;
    }
    public createRow(isHeader: boolean, isFooter: boolean, index: number): HTMLDivElement {
        var row = document.createElement('div');
        row.dataset['rowIndex'] = index.toString();
        if (isHeader) {
            row.classList.add('jql-tbl-hdr-rw');
        } else if (isFooter) {
            row.classList.add('jql-tbl-ftr-rw');
        } else {
            row.classList.add('jql-tbl-rw');
        }
        return row;
    }
    public createRowHeaderCell(rowIndex: string): HTMLDivElement {
        var context = this,
            cell = document.createElement('div');
        cell.textContent = rowIndex;


        cell.classList.add('jql-tbl-rw-hdr-cll');
        cell.classList.add('jql-btn');
        var index: number = parseInt(rowIndex);
        if (index > 0) {

            var index: number = parseInt(rowIndex) - 1; // account for header row
            cell.appendChild(this.createMiniToolbar(index));
            cell.onmousedown = function (e: MouseEvent) {
                context.toggleHighlight(index);
            };
        }
        return cell;
    }
    public createCell(cellData: JSONData, index: number, type: string): HTMLDivElement {
        var cell: HTMLDivElement = document.createElement('div');
        if (cellData.editable == 'True') {
            cell.setAttribute('contenteditable', 'true');
        }
        cell.classList.add('jql-tbl-cll');
        cell.tabIndex = index;
        cell.dataset['index'] = index.toString();
        cell.dataset['name'] = cellData.name;
        cell.dataset['value'] = cellData.value;
        cell.dataset['entityid'] = cellData.entityId.toString();
        if (cellData.href) {
            var a: HTMLAnchorElement = document.createElement('a');
            a.href = cellData.href;
            a.textContent = $('<div/>').html(cellData.text).text();
            cell.appendChild(a);
        } else {
            cell.textContent = $('<div/>').html(cellData.text).text() || ' ';
        }
        this.bindFocus(cell);
        return cell;
    }
    public clearSelected(): void {
        var context = this;
        if (context.selectedCell) {
            var rowIndex: number = context.selectedCell.getRowIndex(),
                textContent: string = context.selectedCell.cell.textContent;
            var dataRow: Array<JSONData> = context.data[rowIndex];
            var index: number = parseInt(context.selectedCell.cell.dataset['index']); // -1 to ignore row header
            if (dataRow[index] && dataRow[index].text) {
                context.setItemValue(rowIndex, index, textContent);
            }
            console.log(context.headers[index].editable);
            // set the value to textContent unless it's not editable. Some non-editable cells (like Equipment Type) have a primary key value to post back on the beforecellchange event
            if (context.headers[index].type === 'text' && context.selectedCell.cell.hasAttribute('contenteditable')) {
                context.selectedCell.cell.dataset['value'] = textContent;
            }
            context.selectedCell.cell.classList.remove('jql-slctd');
            context.selectedCell.cell.removeEventListener('keydown', function () { console.log('unbind keydown'); });
        }
    }
    public select(cell: HTMLDivElement): void {
        var context = this;
        context.bindNavigation(cell);
        var header = context.headers[parseInt(cell.dataset['index'])];
        context.container.dispatchEvent(new Event('beforecellchange'));
        context.selectedCell = new SelectedCell(cell, header.type, header.options);
    }
    public moveDown(): void {
        var context: JSONTable = this;
        if (context.selectedCell) {
            context.container.dispatchEvent(new Event('beforerowchange'));
            var row: HTMLDivElement = <HTMLDivElement>context.selectedCell.cell.parentElement;
            var index: number = $(row).children().index($(context.selectedCell.cell));
            if (row.nextElementSibling && row.nextElementSibling.childNodes) {
                var nextCell: HTMLDivElement = <HTMLDivElement>row.nextElementSibling.childNodes[index];
                if (nextCell) {
                    context.selectedCell.cell.blur();
                    nextCell.focus();
                }
            }
        }
    }
    public moveUp(): void {
        var context = this;
        if (context.selectedCell) {
            context.container.dispatchEvent(new Event('beforerowchange'));
            var row: HTMLDivElement = <HTMLDivElement>context.selectedCell.cell.parentElement;
            var index: number = $(row).children().index($(context.selectedCell.cell));
            if (row.previousElementSibling && !row.previousElementSibling.classList.contains('jql-tbl-hdr-rw') && row.previousElementSibling.childNodes) {
                var nextCell: HTMLDivElement = <HTMLDivElement>row.previousElementSibling.childNodes[index];
                if (nextCell) {
                    context.selectedCell.cell.blur();
                    nextCell.focus();
                }
            }
        }
    }
    public moveLeft(): void {
        var context = this;
        if (context.selectedCell) {
            context.container.dispatchEvent(new Event('beforecolumnchange'));
            var nextCell: HTMLDivElement = <HTMLDivElement>context.selectedCell.cell.previousElementSibling;
            if ((!nextCell || nextCell.classList.contains('jql-tbl-rw-hdr-cll')) && context.selectedCell.cell.parentElement.previousElementSibling) {
                context.container.dispatchEvent(new Event('beforerowchange'));
                nextCell = <HTMLDivElement>context.selectedCell.cell.parentElement.previousElementSibling.lastChild;
            }
            if (nextCell) {
                context.selectedCell.cell.blur();
                nextCell.focus();
            }
        }
    }
    public moveRight(): void {
        var context = this;
        if (context.selectedCell) {
            context.container.dispatchEvent(new Event('beforecolumnchange'));
            var nextCell: HTMLDivElement = <HTMLDivElement>context.selectedCell.cell.nextElementSibling;
            if (!nextCell && context.selectedCell.cell.parentElement.nextElementSibling) {
                var nextRow = <HTMLDivElement>context.selectedCell.cell.parentElement.nextElementSibling;
                context.container.dispatchEvent(new Event('beforerowchange'));
                nextCell = <HTMLDivElement>nextRow.getElementsByClassName('jql-tbl-cll')[0];
            }
            if (nextCell) {
                context.selectedCell.cell.blur();
                nextCell.focus();
            }
        }
    }
    public returnRow(rowIndex: number): Array<JSONData> {
        var context: JSONTable = this;
        return this.data && this.data[rowIndex] ? this.data[rowIndex] : new Array<JSONData>();
    }
    public returnColumn(cellIndex: number): Array<JSONData> {
        var context: JSONTable = this,
            colData: Array<JSONData> = new Array<JSONData>();
        if (context.data && context.data.length > 0) {
            for (var x = 0, length = context.data.length; x < length; x++) {
                colData.push(context.data[x][cellIndex]);
            }
        }
        return colData;
    }
    public toggleHighlight(index: number): void {
        var row: HTMLDivElement = <HTMLDivElement>this.table.getElementsByClassName('jql-tbl-rw')[index];
        row.classList.toggle('jql-hlght');
        var rowData: Array<JSONData> = this.returnRow(index);
        if (row.classList.contains('jql-hlght')) {
            if (!this.highlightedRows) {
                this.highlightedRows = new Array<Array<JSONData>>();
            }
            var add: boolean = true;
            for (var i = 0, length = this.highlightedRows.length; i < length; i++) {
                if (this.highlightedRows[i] == rowData) {
                    add = false;
                    break;
                }
            }
            if (add) {
                this.highlightedRows.push(rowData);
            }
        }
        else {
            if (this.highlightedRows) {
                this.highlightedRows = this.highlightedRows.filter(x => x != rowData);
            }
        }
    }
}

class SelectedCell {
    constructor(cell: HTMLDivElement, type: string, options: Array<HTMLOptionElement>) {
        this.cell = cell;
        this.select(type, options);
    }
    public cell: HTMLDivElement;
    public alert(message: string): void {
        this.cell.parentElement.classList.add('jql-alert');
        if (message && message.length) {
            this.cell.parentElement.title = message;
        }
    }
    public removeAlert(): void {
        this.cell.parentElement.classList.remove('jql-alert');
        this.cell.parentElement.removeAttribute('title');
    }
    public getRowIndex(): number {
        var context: SelectedCell = this,
            index: number = 0;
        var row: HTMLDivElement = <HTMLDivElement>context.cell.parentElement;
        var allRows: JQuery = $(row).parent('.jql-tbl').children('.jql-tbl-rw');
        return Math.max(allRows.index($(row)), 0);
    }
    public getRowValues(includeRowHeader: boolean): Array<string> {
        var context: SelectedCell = this,
            rowValues: Array<string> = new Array<string>();
        var row: HTMLDivElement = <HTMLDivElement>context.cell.parentElement;
        for (var i = includeRowHeader ? 1 : 0; i < row.children.length; i++) { // skip the jQXcel-added cell
            rowValues.push((<HTMLDivElement>row.children[i]).dataset['value']);
        }
        return rowValues;
    }
    public getRowObject(): Object {
        var context: SelectedCell = this,
            rowObject: Object = new Object();
        var row: HTMLDivElement = <HTMLDivElement>context.cell.parentElement;
        for (var i = 1; i < row.children.length; i++) {
            var child = (<HTMLDivElement>row.children[i]);
            rowObject[child.dataset['name']] = child.dataset['value'];
        }
        return rowObject;
    }
    private preventDefault(e): void {
        e = e || window.event;
        if (e.preventDefault)
            e.preventDefault();
        e.returnValue = false;
    }
    private disableScroll(): void {
        // TODO: decide if this is even helpful
        $('body').on('mousewheel', function (e) {
            if (!e.target.classList.contains('jql-tbl-cll')) return;
            e.preventDefault();
            e.stopPropagation();
        });
    }
    private enableScroll(): void {
        $('body').unbind('mousewheel');
    }
    public select(type: string, options: Array<HTMLOptionElement>): void {
        var context = this;
        context.cell.classList.add('jql-slctd');
        if (type === 'select' && options.length) {
            context.disableScroll();
            var select: HTMLUListElement = document.createElement('ul');
            select.classList.add('jql-slct-lst');
            for (var i = 0; i < options.length; i++) {
                var li: HTMLLIElement = document.createElement('li'),
                    text: string = $(options[i]).text(),
                    value: string = $(options[i]).val();
                li.textContent = text;
                li.dataset['value'] = value;
                select.appendChild(li);
            }
            context.cell.appendChild(select);
            $(select).on('click', 'li', function (e: Event) {
                var val = $(this).text();
                context.cell.textContent = val;
                context.cell.dataset['value'] = $(this)[0].dataset['value'];
                context.enableScroll();
            });
            $(context.cell).on('blur', function (e: Event) {
                $(context.cell).find('ul').remove();
                context.enableScroll();
            });
        }
    }
    public unselect() {

    }
}

(function ($, window, document) {
    var defaults = {
        data: new Array<Array<JSONData>>(),
        headers: new Array<JSONHeader>(),
        footer: new Array<JSONData>(),
        beforeRowChange: function () { },
        beforeColumnChange: function () { },
        beforeCellChange: function () { },
        onCopy: function () { },
        onjQXlready: function (table) { },
        toolbarOptions: new ToolbarOptions(true, true, true, true, 'left'),
        themeOptions: new ThemeOptions('blu', 'normal')
    };
    $.fn.jQXel = function (options) {
        defaults = $.extend(defaults, options);
        return this.each(function (index, item) {
            return new JSONTable(
                defaults.data,
                defaults.headers,
                defaults.footer,
                item.id,
                defaults.beforeCellChange,
                defaults.beforeColumnChange,
                defaults.beforeRowChange,
                defaults.onCopy,
                defaults.onjQXlready,
                defaults.toolbarOptions,
                defaults.themeOptions
            );
        });
    };
})(jQuery, window, document);