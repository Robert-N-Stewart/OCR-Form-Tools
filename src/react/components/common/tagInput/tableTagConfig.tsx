// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
    Customizer, ICustomizations, ChoiceGroup, IChoiceGroupOption,
    PrimaryButton, DetailsList, IColumn, TextField, Dropdown, SelectionMode,
    DetailsListLayoutMode, FontIcon, CheckboxVisibility, IContextualMenuItem,
    CommandBar, Selection, Separator, IObjectWithKey, ActionButton
} from "@fluentui/react";
import { getPrimaryGreyTheme, getPrimaryGreenTheme, getRightPaneDefaultButtonTheme, getGreenWithWhiteBackgroundTheme, getPrimaryBlueTheme, getDefaultTheme } from '../../../../common/themes';
import { FieldFormat, FieldType, IApplicationState, ITableRegion, ITableTag, ITag, TableElements, TagInputMode } from '../../../../models/applicationState';
import { filterFormat, useDebounce } from "../../../../common/utils";
import { toast } from "react-toastify";
import "./tableTagConfig.scss";
import { strings } from "../../../../common/strings";
import _ from "lodash";

interface ITableTagConfigProps {
    setTagInputMode: (addTableMode: TagInputMode, selectedTableTagToLabel?: ITableTag, selectedTableTagBody?: ITableRegion[][][]) => void;
    addTableTag: (table: any) => void;
    splitPaneWidth: number;
    tableTag?: ITableTag;
    reconfigureTableConfirm?: (originalTagName: string, tagName: string, tagFormat: FieldFormat, deletedColumns: ITableConfigItem[], deletedRows: ITableConfigItem[], newRows: ITableConfigItem[], newColumns: ITableConfigItem[]) => void;
    selectedTableBody: ITableRegion[][][];
}

interface ITableTagConfigState {
    rows?: ITableConfigItem[],
    columns: ITableConfigItem[],
    name: {
        tableName: string,
        originalTableName?: string;
    },
    format: string,
    headerTypeAndFormat: string;
    originalName?: string;
    deletedRows?: ITableConfigItem[],
    deletedColumns?: ITableConfigItem[],
}
interface ITableConfigItem {
    name: string,
    format: string,
    type: string;
    originalName?: string;
    originalFormat?: string,
    originalType?: string;
}

const tableFormatOptions: IChoiceGroupOption[] = [
    {
        key: FieldFormat.Fixed,
        text: 'fixed-sized',
        iconProps: { iconName: 'Table' }
    },
    {
        key: FieldFormat.RowDynamic,
        text: 'row-dynamic',
        iconProps: { iconName: 'InsertRowsBelow' }
    },
];
const headersFormatAndTypeOptions: IChoiceGroupOption[] = [
    {
        key: TableElements.columns,
        text: 'Column fields',
        iconProps: { iconName: 'TableHeaderRow' }
    },
    {
        key: TableElements.rows,
        text: 'Row\n fields',
        iconProps: { iconName: 'TableFirstColumn' }
    },
];

const dark: ICustomizations = {
    settings: {
        theme: getRightPaneDefaultButtonTheme(),
    },
    scopedSettings: {},
};

const defaultTheme: ICustomizations = {
    settings: {
        theme: getDefaultTheme(),
    },
    scopedSettings: {},
};

const formatOptions = (type = FieldType.String) => {
    const options = [];
    const formats = filterFormat(type)
    Object.entries(formats).forEach(([key, value]) => {
        options.push({ key, text: value })
    });

    return options;
};

const typeOptions = () => {
    const options = [];
    Object.entries(FieldType).forEach(([key, value]) => {
        if (value !== FieldType.Table) {
            options.push({ key, text: value });
        }
    });
    return options;
};

/**
 * @name - Table tag configuration
 * @description - Configures table tag (assigns row's/column's headers and their respective data types and formats)
 */

export default function TableTagConfig(props: ITableTagConfigProps) {
    const { setTagInputMode = null, addTableTag = null, splitPaneWidth = null } = props;
    const containerWidth = splitPaneWidth > 520 ? splitPaneWidth - 10: 510;
    const inputTableName = useRef(null);
    const lastColumnInputRef = useRef(null);
    const lastRowInputRef = useRef(null);
    // Initial state
    let table: ITableTagConfigState;
    if (props.tableTag) {
        if (props.tableTag.format === FieldFormat.Fixed) {
            table = {
                name: {tableName: props.tableTag.name, originalTableName: props.tableTag.name},
                format: FieldFormat.Fixed,
                rows: props.tableTag.rowKeys?.map(row => ({ name: row.fieldKey, type: row.fieldType, format: row.fieldFormat, originalName: row.fieldKey, originalFormat: row.fieldFormat, originalType: row.fieldType })),
                columns: props.tableTag.columnKeys.map(col => ({ name: col.fieldKey, type: col.fieldType, format: col.fieldFormat, originalName: col.fieldKey, originalFormat: col.fieldFormat, originalType: col.fieldType })),
                headerTypeAndFormat: TableElements.columns,
                deletedColumns: [],
                deletedRows: [],
            }
        } else {
            table = {
                name: { tableName: props.tableTag.name, originalTableName: props.tableTag.name },
                format: FieldFormat.RowDynamic,
                rows: [{ name: "", type: FieldType.String, format: FieldFormat.NotSpecified }],
                columns: props.tableTag.columnKeys.map(col => ({ name: col.fieldKey, type: col.fieldType, format: col.fieldFormat, originalName: col.fieldKey, originalFormat: col.fieldFormat, originalType: col.fieldType })),
                headerTypeAndFormat: TableElements.columns,
                deletedColumns: [],
            }
        }

    } else {
        table = {
            name: {tableName: ""},
            format: FieldFormat.Fixed,
            rows: [{ name: "", type: FieldType.String, format: FieldFormat.NotSpecified }],
            columns: [{ name: "", type: FieldType.String, format: FieldFormat.NotSpecified }],
            headerTypeAndFormat: TableElements.columns,
        };
    }

    const currentProjectTags = useSelector<ITag[]>((state: IApplicationState) => state.currentProject.tags);
    const [tableTagName, setTableTagName] = useState(table.name);
    const [format, setFormat] = useState<string>(table.format);
    const [columns, setColumns] = useState(table.columns);
    const [rows, setRows] = useState<ITableConfigItem[]>(table.rows);
    const [notUniqueNames, setNotUniqueNames] = useState<{ columns: [], rows: [], tags: boolean }>({ columns: [], rows: [], tags: false });
    const [headersFormatAndType, setHeadersFormatAndType] = useState<string>(TableElements.columns);
    const [selectedColumn, setSelectedColumn] = useState<IObjectWithKey>(undefined);
    const [selectedRow, setSelectedRow] = useState<IObjectWithKey>(undefined);
    const [deletedColumns, setDeletedColumns] = useState(table.deletedColumns);
    const [deletedRows, setDeletedRows] = useState<ITableConfigItem[]>(table.deletedRows);
    // const [headerTypeAndFormat, setHeaderTypeAndFormat] = useState<string>(table.headerTypeAndFormat);
    const [shouldAutoFocus, setShouldAutoFocus] = useState(null);

    function selectColumnType(idx: number, type: string) {
        setColumns(columns.map((col, currIdx) => idx === currIdx ? { ...col, type, format: FieldFormat.NotSpecified } : col
        ));
    }

    function selectColumnFormat(idx: number, format: string) {
        setColumns(columns.map((col, currIdx) => idx === currIdx ? { ...col, format } : col
        ));
    }
    function selectRowType(idx: number, type: string) {
        setRows(rows.map((row, currIdx) => idx === currIdx ? { ...row, type, format: FieldFormat.NotSpecified } : row
        ));
    }

    function selectRowFormat(idx: number, format: string) {
        setRows(rows.map((row, currIdx) => idx === currIdx ? { ...row, format } : row
        ));
    }

    const detailListWidth = {
        nameInput: containerWidth * 0.45,
        typeInput: containerWidth * 0.176,
        formatInput: containerWidth * 0.176,
    }

    const columnListColumns: IColumn[] = [
        {
            key: "name",
            name: "name",
            fieldName: "name",
            minWidth: detailListWidth.nameInput,
            isResizable: false,
            onRender: (row, index) => {
                return (
                    <TextField
                        componentRef={(index === columns.length - 1 && index !== 0) ? lastColumnInputRef : null}
                        className={"column-name_input"}
                        theme={getGreenWithWhiteBackgroundTheme()}
                        onChange={(e) => handleTextInput(e.target["value"], TableElements.column, index)}
                        value={row.name}
                        errorMessage={getTextInputError(notUniqueNames.columns, row.name.trim(), index)}
                        onRenderLabel={() => {
                            return row.originalName ?
                                <div className={"input-label-original-name original-value"}>
                                    Original name: {row.originalName}
                                </div>
                                : null;
                        }}
                    />
                )
            },
        },
        {
            key: "type",
            name: "type",
            fieldName: "type",
            minWidth: detailListWidth.typeInput,
            isResizable: false,
            onRender: (row, index) => headersFormatAndType === TableElements.columns ?
                <Customizer {...defaultTheme}>
                    <Dropdown
                        style={{ marginTop: 16 }}
                        className="type_dropdown"
                        placeholder={row.type}
                        defaultSelectedKey={FieldType.String}
                        options={typeOptions()}
                        theme={getGreenWithWhiteBackgroundTheme()}
                        onChange={(e, val) => {
                            selectColumnType(index, val.text);
                        }}
                    />
                </Customizer>
                : <></>
        },
        {
            key: "format",
            name: "format",
            fieldName: "format",
            minWidth: detailListWidth.formatInput,
            isResizable: false,
            onRender: (row, index) => headersFormatAndType === TableElements.columns ?
                <Customizer {...defaultTheme}>
                    <Dropdown
                        style={{ marginTop: 16 }}
                        className="format_dropdown"
                        placeholder={row.format}
                        selectedKey={row.format}
                        options={formatOptions(row.type)}
                        theme={getGreenWithWhiteBackgroundTheme()}
                        onChange={(e, val) => {
                            selectColumnFormat(index, val.text);
                        }}
                    />
                </Customizer>
                : <></>
        },
    ];

    const rowListColumns: IColumn[] = [
        {
            key: "name",
            name: "name",
            fieldName: "name",
            minWidth: detailListWidth.nameInput,
            isResizable: false,
            onRender: (row, index) => {
                return (
                    <TextField
                        componentRef={(index === rows.length - 1 && index !== 0) ? lastRowInputRef : null}
                        className="row-name_input"
                        theme={getGreenWithWhiteBackgroundTheme()}
                        onChange={(e) => handleTextInput(e.target["value"], TableElements.row, index)}
                        value={row.name}
                        errorMessage={getTextInputError(notUniqueNames.rows, row.name, index)}
                        onRenderLabel={() => {
                            return row.originalName ?
                                <div className={"input-label-original-name original-value"}>
                                    Original name: {row.originalName}
                                </div>
                                : null;
                        }}
                    />
                )
            },
        },
        {
            key: "type",
            name: "type",
            fieldName: "type",
            minWidth: detailListWidth.typeInput,
            isResizable: false,
            onRender: (row, index) => headersFormatAndType === TableElements.rows ?
                <Customizer {...defaultTheme}>
                    <Dropdown
                        className="type_dropdown"
                        style={{ marginTop: 16 }}
                        placeholder={row.type}
                        defaultSelectedKey={FieldType.String}
                        options={typeOptions()}
                        theme={getGreenWithWhiteBackgroundTheme()}
                        onChange={(e, val) => {
                            selectRowType(index, val.text);
                        }}
                    />
                </Customizer>
                : <></>
        },
        {
            key: "format",
            name: "format",
            fieldName: "format",
            minWidth: detailListWidth.formatInput,
            isResizable: false,
            onRender: (row, index) => headersFormatAndType === TableElements.rows ?
                <Customizer {...defaultTheme}>
                    <Dropdown
                        className="format_dropdown"
                        style={{ marginTop: 16 }}
                        placeholder={row.format}
                        selectedKey={row.format}
                        options={formatOptions(row.type)}
                        theme={getGreenWithWhiteBackgroundTheme()}
                        onChange={(e, val) => {
                            selectRowFormat(index, val.text);
                        }}
                    />
                </Customizer>
                : <></>
        },
    ];


    function addColumn() {
        setColumns([...columns, { name: "", type: FieldType.String, format: FieldFormat.NotSpecified }]);
        setShouldAutoFocus(TableElements.column);
    }

    function addRow() {
        setRows([...rows, { name: "", type: FieldType.String, format: FieldFormat.NotSpecified }]);
        setShouldAutoFocus(TableElements.row);
    }

    function handleTextInput(name: string, role: string, index: number) {
        if (role === TableElements.column) {
            setColumns(
                columns.map((column, currIndex) => (index === currIndex)
                    ? { ...column, name }
                    : column)
            );
        } else {
            setRows(
                rows.map((row, currIndex) => (index === currIndex) ?
                    { ...row, name }
                    : row)
            );
        };
    }

    function setTableName(name: string) {
        setTableTagName({...tableTagName,tableName: name});
    }

    // Row/Column headers command bar (reorder, delete)
    function getRowsHeaderItems(): IContextualMenuItem[] {
        const currSelectionIndex = rowSelection.getSelectedIndices()[0];
        return [
            {
                key: 'Name',
                text: 'Name',
                className: "list-headers_name",
                style: { width: detailListWidth.nameInput - 122 },
                disabled: true,
            },
            {
                key: 'moveUp',
                text: 'Move up',
                iconOnly: true,
                iconProps: { iconName: 'Up' },
                onClick: (e) => {
                    onReOrder(-1, TableElements.rows)
                },
                disabled: !selectedRow || currSelectionIndex === 0,
            },
            {
                key: 'moveDown',
                text: 'Move down',
                iconOnly: true,
                iconProps: { iconName: 'Down' },
                onClick: (e) => {
                    onReOrder(1, TableElements.rows)
                },
                disabled: !selectedRow! || currSelectionIndex === rows.length - 1,
            },
            {
                key: 'deleteRow',
                text: 'Delete row',
                iconOnly: true,
                iconProps: { iconName: 'Delete' },
                onClick: () => {
                    const selectedRowIndex =  rowSelection.getSelectedIndices()[0];
                    if (props.tableTag && rows[selectedRowIndex].originalName) {
                        const deletedRow = Object.assign({}, rows[selectedRowIndex]);
                        deletedRow.name = deletedRow.originalName;
                        deletedRow.format = deletedRow.originalFormat;
                        deletedRow.type = deletedRow.originalType;
                        setDeletedRows([...deletedRows, deletedRow]);
                    }
                    setRows(rows.filter((i, idx) => idx !== rowSelection.getSelectedIndices()[0]))
                },
                disabled: !selectedRow! || rows.length === 1,
            },
            {
                key: 'type',
                text: 'Type',
                className: "list-headers_type",
                style: { width: detailListWidth.typeInput },
                disabled: true,
            },
            {
                key: 'format',
                text: 'Format',
                className: "list-headers_format",
                disabled: true,
            },
        ];
    };
    function getColumnsHeaderItems(): IContextualMenuItem[] {
        const currSelectionIndex = columnSelection.getSelectedIndices()[0];

        return [
            {
                key: 'Name',
                text: 'Name',
                className: "list-headers_name",
                style: { width: detailListWidth.nameInput - 120 },
                disabled: true,
                resizable: true,
            },
            {
                key: 'moveUp',
                text: 'Move up',
                iconOnly: true,
                iconProps: { iconName: 'Up' },
                onClick: (e) => {
                    onReOrder(-1, TableElements.columns)

                },
                disabled: !selectedColumn || currSelectionIndex === 0,
            },
            {
                key: 'moveDown',
                text: 'Move down',
                iconOnly: true,
                iconProps: { iconName: 'Down' },
                onClick: (e) => {
                    onReOrder(1, TableElements.columns)
                },
                disabled: !selectedColumn || currSelectionIndex === columns.length - 1,
            },
            {
                key: 'deleteColumn',
                text: 'Delete column',
                iconOnly: true,
                iconProps: { iconName: 'Delete', },
                onClick: () => {
                    const selectedColumnIndex = columnSelection.getSelectedIndices()[0];
                    if (props.tableTag && columns[selectedColumnIndex].originalName) {
                        const deletedColumn = Object.assign({}, columns[selectedColumnIndex]);
                        deletedColumn.name = deletedColumn.originalName
                        deletedColumn.format = deletedColumn.originalFormat;
                        deletedColumn.type = deletedColumn.originalType;
                        setDeletedColumns([...deletedColumns, deletedColumn])
                    }
                    setColumns(columns.filter((i, idx) => idx !== selectedColumnIndex));
                },
                disabled: !selectedColumn || columns.length === 1,
            },
            {
                key: 'type',
                text: 'Type',
                className: "list-headers_type",
                style: { width: detailListWidth.typeInput },
                disabled: true,
            },
            {
                key: 'format',
                text: 'Format',
                className: "list-headers_format",
                disabled: true,
            },
        ];
    };

    // Validation //
    function getTextInputError(array: any[], rowName: string, index: number) {
        if (!rowName?.length) {
            return strings.tags.regionTableTags.configureTag.errors.emptyName
        } else if (array.length && array.findIndex((item) => (item === index)) !== -1) {
            return strings.tags.regionTableTags.configureTag.errors.notUniqueName;
        } else {
            return undefined;
        }
    };

    function checkNameUniqueness(array: ITableConfigItem[], arrayName: string) {
        const namesMap = {};
        let notUniques = [];
        array.forEach((item, idx) => {

            if (item.name && item.name.length) {
                const name = item.name.trim();
                namesMap[name] = namesMap[name] || [];
                namesMap[name].push(idx)
            }
        });

        for (const name in namesMap) {
            if (namesMap[name].length > 1) {
                notUniques = namesMap[name];
            }
        }
        setNotUniqueNames({ ...notUniqueNames, [arrayName]: notUniques })
    }

    // Check names uniqueness for rows and columns as you type , with a delay
    const delay = 400;
    const debouncedColumns = useDebounce(columns, delay);
    const debouncedRows = useDebounce(rows, delay);

    useEffect(() => {
        if (columns) {
            checkNameUniqueness(debouncedColumns, TableElements.columns)
        }
    }, [debouncedColumns]);

    useEffect(() => {
        if (rows) {
            checkNameUniqueness(debouncedRows, TableElements.rows);
        }
    }, [debouncedRows]);

    // Check tableName uniqueness as type
    const debouncedTableTagName = useDebounce(tableTagName, delay);

    useEffect(() => {
        if (tableTagName) {
            const existingTagName = currentProjectTags.find((item: ITag) => item.name === tableTagName.tableName.trim());
            setNotUniqueNames({ ...notUniqueNames, tags: existingTagName !== undefined ? true : false })
        }
    }, [debouncedTableTagName, currentProjectTags]);

    function trimFieldNames(array: ITableConfigItem[]) {
        return array.map(i => ({ ...i, name: i.name.trim() }));
    }

    function save(cleanTableName: string, cleanRows: ITableConfigItem[], cleanColumns: ITableConfigItem[]) {
        const tableTagToAdd = {
            name: cleanTableName,
            columns: cleanColumns,
            format,
            headersFormatAndType
        }
        if (format === FieldFormat.Fixed) {
            tableTagToAdd[TableElements.rows] = cleanRows;
        }
        addTableTag(tableTagToAdd);
        setTagInputMode(TagInputMode.Basic, null, null);
        toast.success(`Successfully ${props.tableTag ? "reconfigured" : "saved"} "${tableTagName.tableName}" table tag.`, { autoClose: 8000 });
    }

    function hasEmptyNames(array: ITableConfigItem[]) {
        return array.find((i) => !i.name.length) !== undefined ? true : false
    }



    function getCleanTable() {
        let cleanRows = rows;
        let cleanColumns = columns;
        if (headersFormatAndType === TableElements.columns) {
            cleanRows = rows.map((row) => {
                return {
                    ...row,
                    type: FieldType.String,
                    format: FieldFormat.NotSpecified,
                }
            });
        } else if (headersFormatAndType === TableElements.rows) {
            cleanColumns = columns.map((col) => ({
                ...col,
                type: FieldType.String,
                format: FieldFormat.NotSpecified
            }));
        }
        cleanColumns = trimFieldNames(columns);
        if (format === FieldFormat.Fixed) {
            cleanRows = trimFieldNames(rows);
        }
        const cleanTableName = tableTagName.tableName.trim();
        // const cleanOriginalTableName = tableTagName?.originalTableName?.trim();
        return { cleanTableName, cleanRows, cleanColumns };
    }

    function validateInput() {
        return !(
            notUniqueNames.rows.length > 0
            || notUniqueNames.columns.length > 0
            || (props.tableTag && notUniqueNames.tags && (tableTagName.tableName !== tableTagName.originalTableName))
            || (notUniqueNames.tags && !props.tableTag)
            || !tableTagName.tableName.length
            || hasEmptyNames(columns)
            || (format === FieldFormat.Fixed && hasEmptyNames(rows))
        );
    }

    // Row selection
    const rowSelection = useMemo(() =>
        new Selection({
            onSelectionChanged: () => {
                setSelectedRow(rowSelection.getSelection()[0])
            }, selectionMode: SelectionMode.single,
        }), []
    );

    const columnSelection = useMemo(() =>
        new Selection({
            onSelectionChanged: () => {
                setSelectedColumn(columnSelection.getSelection()[0])
            }, selectionMode: SelectionMode.single,
        }), []
    );

    // Reorder items
    function onReOrder(displacement: number, role: string) {
        const items = role === TableElements.rows ? [...rows] : [...columns];
        const selection = role === TableElements.rows ? rowSelection : columnSelection;
        const selectedIndex = selection.getSelectedIndices()[0];
        const itemToBeMoved = items[selectedIndex];
        const newIndex = selectedIndex + displacement;
        if (newIndex < 0 || newIndex > items.length - 1) {
            return;
        }

        items.splice(selectedIndex, 1);
        items.splice(newIndex, 0, itemToBeMoved);

        if (role === TableElements.rows) {
            rowSelection.setIndexSelected(newIndex, true, false);
            setRows(items);
        } else {
            columnSelection.setIndexSelected(newIndex, true, true);
            setColumns(items);
        }
    }

    function restoreDeletedField(fieldType: TableElements, index: number) {
        let fields;
        let deletedFields;
        let setFields;
        let setDeletedFields;
        switch (fieldType) {
            case TableElements.row:
                fields = rows;
                deletedFields = [...deletedRows];
                setFields = setRows;
                setDeletedFields = setDeletedRows;
                break;
            case TableElements.column:
                fields = columns;
                deletedFields = [...deletedColumns];
                setFields = setColumns;
                setDeletedFields = setDeletedColumns;
                break;
        }
        setFields([...fields, deletedFields[index]]);
        setDeletedFields([...deletedFields].slice(0, index).concat([...deletedFields].slice(index+1, deletedFields.length)));
    }

    function getDeletedFieldsTable(fieldType: TableElements) {
        let deletedFields;
        switch (fieldType) {
            case TableElements.row:
                console.log("deleted rows");
                deletedFields = deletedRows;
                break;
            case TableElements.column:
                console.log("deleted columns");
                deletedFields = deletedColumns;
                break;
        }
        const tableBody = [[
            <tr className="compact-row" key={"row-h"}>
                <th key={"row-h-0"} className="">
                    <div className="mr-4">
                        {fieldType.charAt(0).toUpperCase() + fieldType.slice(1) + " fields that'll be deleted"}
                    </div>
                </th>
                <th key={"row-h-1"} className=""></th>
            </tr>
        ]];
        for (let i = 0; i < deletedFields.length; i++) {
            tableBody.push([
                <tr className="compact-row" key={`row-${i}`}>
                    <td key={`cell-${i}-0`} className="">
                        <div className="flex-center">
                            {deletedFields[i].originalName}
                        </div>
                    </td>
                    <td key={`cell-${i}-1`} className="">
                        <ActionButton className="restore-button flex-center"
                            onClick={() => {
                                restoreDeletedField(fieldType, i)
                            }}>
                            <FontIcon className="restore-icon mr-1" iconName="UpdateRestore" />
                            Restore
                        </ActionButton>
                    </td>
                </tr>
            ])
        }
        return tableBody;
    }

    // Table preview
    function getTableBody() {
        let tableBody = null;
        const isRowDynamic = format === FieldFormat.RowDynamic;
        if (table.rows.length !== 0 && table.columns.length !== 0) {
            tableBody = [];
            for (let i = 0; i < (isRowDynamic ? 2 : rows.length + 1); i++) {
                const tableRow = [];
                for (let j = 0; j < columns.length + 1; j++) {
                    if (i === 0 && j !== 0) {
                        const columnHeaderWasRenamed = props.tableTag && columns[j - 1].name !== columns[j - 1].originalName;
                        tableRow.push(
                            <th key={`col-h-${j}`} className="header_column">
                                {columnHeaderWasRenamed &&
                                    <div className="renamed-value">{columns[j - 1].originalName}</div>
                                }
                                <div className="original-value">
                                    {columns[j - 1].name}
                                </div>
                            </th>);
                    } else if (j === 0 && i !== 0) {
                        if (!isRowDynamic) {
                            const rowHeaderWasRenamed = props.tableTag && rows[i - 1].name !== rows[i - 1].originalName;
                            tableRow.push(
                                <th key={`row-h-${j}`} className="header_row">
                                    {rowHeaderWasRenamed &&
                                        <div className="renamed-value">
                                            {rows[i - 1].originalName}
                                        </div>
                                    }
                                    <div className="original-value">
                                        {rows[i - 1].name}
                                    </div>
                                </th>
                            );
                        }
                    } else if (j === 0 && i === 0) {
                        if (!isRowDynamic) {
                            tableRow.push(<th key={"ignore"} className="header_empty" ></th>);
                        }
                    } else {
                        tableRow.push(<td key={`cell-${i}-${j}`} className="table-cell" />);
                    }
                }
                tableBody.push(<tr key={`row-${i}`}>{tableRow}</tr>);
            }
        }
        return tableBody
    };


    function getTableTagNameErrorMessage(): string {
        if (props.tableTag && tableTagName.tableName.trim() === props.tableTag.name) {
            return "";
        } else if (!tableTagName.tableName.trim().length) {
            return strings.tags.regionTableTags.configureTag.errors.assignTagName
        } else if (notUniqueNames.tags) {
            return strings.tags.regionTableTags.configureTag.errors.notUniqueTagName;
        }
        return "";
    }

    const [tableChanged, setTableChanged] = useState<boolean>(false);
    useEffect(() => {
        setTableChanged(
            (_.isEqual(columns, table.columns) && _.isEqual(rows, table.rows)) ? false : true)
    }, [columns, rows, table.columns, table.rows]);

    // Focus once on table name input when the component loads
    useEffect(() => {
        inputTableName.current.focus();
    }, []);
    // Sets focus on last added input
    useEffect(() => {
        if (shouldAutoFocus === TableElements.column && lastColumnInputRef.current) {
            lastColumnInputRef.current.focus();
        }
        else if (shouldAutoFocus === TableElements.row && lastRowInputRef.current) {
            lastRowInputRef.current.focus();
        }
        setShouldAutoFocus(null);
    }, [shouldAutoFocus]);

    // Render
    return (
        <Customizer {...dark}>
            <div className="config-view_container">
                <h4 className="mt-2">{props.tableTag ? "Reconfigure table tag" : "Configure table tag"}</h4>
                <h5 className="mt-3 mb-1">Name</h5>
                {tableTagName.originalTableName &&
                    <div className={"original-table-name"}>
                        Original name: {tableTagName.originalTableName}
                    </div>
                }
                <TextField
                    componentRef={inputTableName}
                    className="table-name_input ml-12px"
                    theme={getGreenWithWhiteBackgroundTheme()}
                    onChange={(event) => setTableName(event.target["value"])}
                    value={tableTagName.tableName}
                    errorMessage={getTableTagNameErrorMessage()}
                />
                {!props.tableTag &&
                    <>
                        <h5 className="mt-4">Format</h5>
                        <ChoiceGroup
                            className="ml-12px"
                            onChange={(event, option) => {
                                setFormat(option.key)
                                if (option.key === FieldFormat.RowDynamic) {
                                    setHeadersFormatAndType(TableElements.columns);
                                }
                            }}
                            defaultSelectedKey={FieldFormat.Fixed}
                            options={tableFormatOptions}
                            theme={getRightPaneDefaultButtonTheme()}
                        />
                        {format === FieldFormat.Fixed && <>
                            <h5 className="mt-4" >Configure type and format for:</h5>
                            <ChoiceGroup
                                className="ml-12px type-format"
                                defaultSelectedKey={TableElements.columns}
                                options={headersFormatAndTypeOptions}
                                onChange={(e, option) => setHeadersFormatAndType(option.key)}
                                required={false} />
                        </>
                        }
                    </>
                }
                <div className="columns_container ml-12px">
                    <h5 className="mt-3">Column fields</h5>
                    <div className="columns-list_container">
                        <DetailsList
                            className="columns"
                            items={columns}
                            columns={columnListColumns}
                            isHeaderVisible={true}
                            theme={getRightPaneDefaultButtonTheme()}
                            compact={false}
                            setKey="none"
                            selection={columnSelection}
                            layoutMode={DetailsListLayoutMode.justified}
                            checkboxVisibility={CheckboxVisibility.always}
                            onRenderDetailsHeader={() => (
                                <div className="list_header">
                                    <CommandBar items={getColumnsHeaderItems()} />
                                    <Separator styles={{ root: { height: 2, padding: 0 } }} />
                                </div>
                            )}

                        />
                    </div>
                    <PrimaryButton
                        theme={getPrimaryBlueTheme()}
                        className="add_button ml-12px"
                        onClick={addColumn}>
                        <FontIcon iconName="Add" className="mr-2" />
                    Add column
                </PrimaryButton>
                {deletedColumns?.length > 0 &&
                <div className="mt-3">
                    <table className="">
                            <tbody>
                                {getDeletedFieldsTable(TableElements.column)}
                            </tbody>
                        </table>
                    </div>
                }
                </div>
                {(format === FieldFormat.Fixed || (props.tableTag && format === FieldFormat.Fixed)) &&
                    <div className="rows_container ml-12px">
                        <h5 className="">Row fields</h5>
                        <div className="rows-list_container">
                            <DetailsList
                                className="rows"
                                items={rows}
                                columns={rowListColumns}
                                isHeaderVisible={true}
                                theme={getRightPaneDefaultButtonTheme()}
                                compact={false}
                                setKey="none"
                                selection={rowSelection}
                                layoutMode={DetailsListLayoutMode.justified}
                                checkboxVisibility={CheckboxVisibility.always}
                                selectionPreservedOnEmptyClick={true}
                                onRenderDetailsHeader={() => (
                                    <div className="list_header">
                                        <CommandBar items={getRowsHeaderItems()} />
                                        <Separator styles={{ root: { height: 2, padding: 0 } }} />
                                    </div>
                                )}
                            />
                        </div>
                        <PrimaryButton
                            theme={getPrimaryBlueTheme()}
                            className="add_button"
                            onClick={addRow}>
                            <FontIcon iconName="Add" className="mr-2" />
                                Add row
                            </PrimaryButton>
                            {deletedRows?.length > 0 &&
                                <div className="mt-3">
                                    <table className="">
                                        <tbody>
                                            {getDeletedFieldsTable(TableElements.row)}
                                        </tbody>
                                    </table>
                                </div>
                            }
                    </div>
                }
                {
                    (tableChanged || props.tableTag) &&
                    <div className="preview_container  ml-12px">
                        <h5 className="mt-3 mb-1">Preview</h5>
                        {tableTagName.tableName &&
                            <>
                                {props.tableTag && tableTagName.originalTableName !== tableTagName.tableName &&
                                    <div className="tableName-original original-value">
                                        Table name: {tableTagName.originalTableName}
                                    </div>
                                }
                            <span className="tableName-current"
                                style={{ borderBottom: props.tableTag ? `4px solid ${props.tableTag.color}` : null }}>
                                    <span>Table name: </span>
                                    <span className="table-name-preview">{tableTagName.tableName}</span>
                                </span>
                            </>
                        }
                        {
                            format === FieldFormat.RowDynamic && <div className="rowDynamic_message">The number of rows is specified when labeling each document.</div>
                        }
                        <div className="table_container">
                            <table className="table">
                                <tbody>
                                    {getTableBody()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                }
                <div className="control-buttons_container">
                    <PrimaryButton
                        className="cancel"
                        theme={getPrimaryGreyTheme()}
                        onClick={() => {
                            if (props.tableTag) {
                                if (props.selectedTableBody) {
                                    if (!props.selectedTableBody[0].length || props.selectedTableBody.length !== 0)
                                        setTagInputMode(TagInputMode.LabelTable,
                                            props.tableTag,
                                            props.selectedTableBody);
                                } else {
                                    setTagInputMode(TagInputMode.Basic, null, null);
                                }
                            } else {
                                setTagInputMode(TagInputMode.Basic, null, null);
                            }
                        }}>Cancel</PrimaryButton>
                    <PrimaryButton
                        className="save"
                        theme={getPrimaryGreenTheme()}
                        onClick={() => {
                            if (!validateInput()) {
                                toast.error(strings.tags.regionTableTags.configureTag.errors.checkFields, { autoClose: 8000 });
                                return;
                            } else {
                                const { cleanTableName, cleanRows, cleanColumns} = getCleanTable();
                                if (props.tableTag) {
                                    const tableTagToReconfigure = {
                                        name: cleanTableName,
                                        columns: cleanColumns,
                                        deletedColumns,
                                        headersFormatAndType
                                    }
                                    if (format === FieldFormat.Fixed) {
                                        tableTagToReconfigure[TableElements.rows] = cleanRows;
                                        tableTagToReconfigure["deletedRows"] = deletedRows;
                                        tableTagToReconfigure["format"] = FieldFormat.Fixed
                                    } else {
                                        tableTagToReconfigure[TableElements.rows] = null;
                                        tableTagToReconfigure["deletedRows"] = null;
                                        tableTagToReconfigure["format"] = FieldFormat.RowDynamic
                                    }
                                    props.reconfigureTableConfirm(tableTagName?.originalTableName?.trim(), tableTagName?.tableName?.trim(), tableTagToReconfigure["format"], deletedColumns, deletedRows, tableTagToReconfigure["rows"], tableTagToReconfigure.columns);
                                } else {
                                    save(cleanTableName, cleanRows, cleanColumns);
                                }
                            }
                        }
                        }>Save</PrimaryButton>
                </div>
            </div>
        </Customizer>
    );
};