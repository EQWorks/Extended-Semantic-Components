import React, { Component } from 'react'
import PropTypes from 'prop-types'

import { Table, Pagination, Button, Form } from 'semantic-ui-react'
import numeral from 'numeral'

import DataTableColumn, {
  propTypes as columnProps,
  defaultProps as columnDefaultProps,
} from './data-table-column'
import { sort, defaultSearch, getDefaultSortType } from '../utils'

const colPropKeys = Object.keys(columnProps)

const childrenColumnCheck = (props, propName, componentName) => {
  if (props.children && props.columns) {
    return new Error(`Only one or none of 'children' or 'columns' is allowed in '${componentName}'`)
  }
}

const propTypes = {
  data: PropTypes.array.isRequired,
  children: childrenColumnCheck,
  columns: childrenColumnCheck,
  defaultSortKey: PropTypes.string,
  defaultSortDir: PropTypes.oneOf(['descending', 'ascending']),
  downloadName: PropTypes.string,
  download: PropTypes.bool,
  perPage: PropTypes.number,
  onRowClick: PropTypes.func,
  isRowActive: PropTypes.func,
  emptySearchMsg: PropTypes.string,
  noColumnsMsg: PropTypes.string,
  noDataMsg: PropTypes.string,
  downloadPicked: PropTypes.bool,
  search: PropTypes.func,
  cellStyles: PropTypes.object,
  rowStyles: PropTypes.object,
  colStyles: PropTypes.object,
}

const defaultProps = {
  defaultSortKey: '',
  defaultSortDir: 'descending',
  downloadName: 'Table',
  download: true,
  perPage: 9,
  onRowClick: null,
  isRowActive: null,
  emptySearchMsg: "Couldn't find anything :(",
  noColumnsMsg: 'No columns selected',
  noDataMsg: 'Empty data :(',
  downloadPicked: false,
  search: null,
  cellStyles: {},
  rowStyles: {},
  colStyles: {},
}


class DataTable extends Component {
  constructor(props) {
    super(props)

    const {
      defaultSortKey: sortColumn,
      defaultSortDir: sortDirection,
    } = props

    const picked = this.pickables()
    this.state = {
      sortColumn,
      sortDirection,
      activePage: 1,
      searchInput: '',
      picked,
    }
  }

  downloadReport = () => {
    const { data, downloadName, downloadPicked } = this.props

    const columns = downloadPicked ? this.pickedColumns() : this.columns()
    const headers = columns.map(c => c.name)
    const valueKeys = columns.map(c => c.dataKey)

    let csvContent = ''

    headers.forEach((h) => {
      csvContent += `"${String(h).replace(/"/g, '""')}",`
    })
    csvContent = csvContent.slice(0, -1)
    csvContent += '\r\n'

    data.forEach((d) => {
      valueKeys.forEach((x) => {
        csvContent += `"${String(d[x]).replace(/"/g, '""')}",`
      })
      csvContent = csvContent.slice(0, -1)
      csvContent += '\r\n'
    })

    const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${downloadName}.csv`)
    document.body.appendChild(link)

    link.click()
    link.remove()
  }

  columns = () => {
    const { children, columns, data} = this.props
    if (!data || data.length === 0) return []

    if (!children && !columns) {
      const defaultColumns = []
      Object.keys(data[0]).forEach(key => (key !== '_id' && defaultColumns.push({
        ...columnDefaultProps,
        name: key,
        dataKey: key,
        pickable: true,
        searchable: true,
        sortType: getDefaultSortType(data, key)
      })))
      return defaultColumns
    }

    if (Array.isArray(columns) && columns.length > 0) {
      // apply default here since columns are not DataTableColumn instances
      return columns.map(c => ({
        ...columnDefaultProps,
        sortType: getDefaultSortType(data, c.dataKey),
        ...c,
      }))
    }

    return React.Children.toArray(children)
      .filter(c => c.type === DataTableColumn || c.type.name === 'DataTableColumn')
      .map(c => ({
        sortType: getDefaultSortType(data, c.props.dataKey),
        ...c.props,
      }))
  }

  searchables = () => this.columns().filter(c => c.searchable).map(c => c.dataKey)

  pickables = () => this.columns().filter(c => c.pickable).map(c => c.name)

  pickedColumns = () => {
    const { picked } = this.state

    return this.columns().filter(c => !c.pickable || picked.includes(c.name))
  }

  onPageChange = (_, { activePage }) => {
    this.setState({ activePage })
  }

  handleSort = column => () => {
    const { sortColumn, sortDirection } = this.state
    if (column === sortColumn) {
      this.setState({
        activePage: 1,
        sortDirection:
          sortDirection === 'ascending' ? 'descending' : 'ascending',
      })
    } else {
      this.setState({
        activePage: 1,
        sortColumn: column,
        sortDirection: 'ascending',
      })
    }
  }

  handlePick = name => () => {
    const { picked } = this.state

    if (picked.includes(name)) {
      this.setState({ picked: picked.filter(c => c !== name) })
    } else {
      this.setState({ picked: [...picked, name] })
    }
  }

  getFilteredData() {
    const { data, search } = this.props
    const { searchInput } = this.state
    const text = searchInput.toLowerCase()
    const searchables = this.searchables()
    if (searchables.length === 0) {
      return data
    } else if (search) {
      return search(text, data, searchables)
    }
    return defaultSearch(text, data, searchables)
  }

  onSearchInputChange = (_, { value }) => {
    if (value && value.length > 2) {
      this.setState({ activePage: 1 })
    }
    this.setState({ searchInput: value.toLowerCase() })
  }

  createRowClickListener = (rowData) => (mouseEvent) => {
    return this.props.onRowClick(mouseEvent, rowData)
  }

  renderCell = (row, col) => {
    const value = row[col.dataKey]
    if (col.nullTemplate && (value === null || value === undefined)) {
      return col.nullTemplate
    }
    if (col.format) {
      return numeral(value).format(col.format)
    }
    if (col.template) {
      return col.template(value, row, col.dataKey)
    }
    if (value && typeof value === 'object') {
      return JSON.stringify(value)
    }

    return value
  }

  // conditionParams = { value, row, rowIdx, colIdx }
  evalStyle = ({ style, conditionParams }) => style &&
    (!style.condition || style.condition({ ...conditionParams }))
  /* eslint-disable-next-line no-unused-vars */
  removeCondition = ({ condition, ...style }) => style

  evalStyles = ({ cellStyle, rowStyle, colStyle, ...conditionParams }) => {
    let style = {}
    // priority = cell > row > col
    if (this.evalStyle({ style: colStyle, conditionParams })) {
      style = colStyle
    } else if (this.evalStyle({ style: rowStyle, conditionParams })) {
      style = rowStyle
    } else if (this.evalStyle({ style: cellStyle, conditionParams })) {
      style = cellStyle
    }

    if (style.dynamic) {
      return style.dynamic({ ...conditionParams })
    }
    return this.removeCondition(style)
  }

  render() {
    const {
      data,
      download,
      perPage,
      onRowClick,
      isRowActive,
      emptySearchMsg,
      noColumnsMsg,
      noDataMsg,
      cellStyles,
      rowStyles,
      colStyles,
    } = this.props
    const tableProps = Object.entries(this.props)
      .filter(([key]) => !Object.keys(propTypes).includes(key))
      .reduce((acc, [key, value]) => {
        acc[key] = value
        return acc
      }, {})
    const { activePage, sortColumn, sortDirection, searchInput, picked } = this.state

    // set unique row key
    let thisData = data.map((row, i) => ({
      ...row,
      _id: i,
    }))

    // searching
    const searchables = this.searchables()
    const filteredData = searchInput && searchInput.length > 2
      ? this.getFilteredData()
      : thisData

    const columns = this.pickedColumns()

    if (sortColumn !== '') {
      const { sortType } = this.columns().find(o => o.dataKey === sortColumn)
      filteredData.sort(
        (a, b) => sort(sortType, sortDirection)(a[sortColumn], b[sortColumn])
      )
    }

    // pagination
    const offset = perPage * activePage
    const totalPages = Math.ceil(filteredData.length / perPage)
    const paginatedData = filteredData.filter((d, i) => i >= (offset - perPage) && i < offset)

    // pick/toggle
    const pickables = this.pickables()

    return (
      <div style={{ marginTop: '1em', paddingBottom: '1em' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          {(download || searchables.length > 0) && (
            <div style={{
              padding: '8px',
              border: '1px solid rgba(34, 36, 38, 0.15)',
              borderBottom: 0,
              borderRadius: '4px 4px 0px 0px',
              background: '#F9FAFB',
              overflow: 'auto',
            }}
            >
              <Form size='mini'>
                {searchables.length > 0 && (
                  <Form.Input
                    type='text'
                    placeholder='Search...'
                    value={searchInput}
                    onChange={this.onSearchInputChange}
                    icon='search'
                  />
                )}
                <div>
                  {pickables.length > 0 && (
                    <Button.Group size='mini'>
                      {pickables.map(name => (
                        <Button
                          key={name}
                          content={name}
                          primary={picked.includes(name)}
                          onClick={this.handlePick(name)}
                        />
                      ))}
                    </Button.Group>
                  )}
                  {download && (
                    <Button
                      floated='right'
                      size='mini'
                      onClick={this.downloadReport}
                      color='blue'
                      icon='download'
                    />
                  )}
                </div>
              </Form>
            </div>
          )}
          <Table
            sortable
            selectable
            style={{ marginTop: 0, borderRadius: 0 }}
            {...tableProps}
          >
            <Table.Header>
              <Table.Row>
                {columns.map(col => (
                  <Table.HeaderCell
                    key={col.dataKey || col.name}
                    onClick={col.sortable ? this.handleSort(col.dataKey) : null}
                    sorted={sortColumn === col.dataKey ? sortDirection : null}
                  >
                    {col.name}
                  </Table.HeaderCell>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {
                paginatedData.length === 0 &&
                columns.length>0 &&
                <Table.Row textAlign='center'>
                  <Table.HeaderCell colSpan={columns.length}>{emptySearchMsg}</Table.HeaderCell>
                </Table.Row>
              }
              {
                columns.length === 0 && data.length !== 0 &&
                <Table.Row textAlign='center'>
                  <Table.HeaderCell colSpan={columns.length}>{noColumnsMsg}</Table.HeaderCell>
                </Table.Row>
              }
              {
                data.length === 0 &&
                <Table.Row textAlign='center'>
                  <Table.HeaderCell colSpan={columns.length}>{noDataMsg}</Table.HeaderCell>
                </Table.Row>
              }
              {paginatedData.map((row, rowIdx) => (
                <Table.Row
                  key={row._id}
                  active={typeof isRowActive === 'function' ? isRowActive(row) : undefined}
                  onClick={typeof onRowClick === 'function' ? this.createRowClickListener(row) : undefined}>
                  {columns.map((col, colIdx) => {
                    // split out generic ...celProps passed-through similar to ...tableProps
                    const cellProps = { ...col }
                    const colProps = {}
                    colPropKeys.forEach((key) => {
                      if (key in cellProps) {
                        colProps[key] = cellProps[key]
                        delete cellProps[key]
                      }
                    })
                    const cellStyle = cellStyles[`${rowIdx}-${colIdx}`] || cellStyles['-1']
                    const rowStyle = rowStyles[rowIdx] || rowStyles['-1']
                    const colStyle = colStyles[colIdx] || colStyles['-1']
                    const style = this.evalStyles({ cellStyle, rowStyle, colStyle, value: row[col.dataKey], row, rowIdx, colIdx})
                    return (
                      <Table.Cell key={col.dataKey || col.name} {...cellProps} {...style}>
                        {this.renderCell(row, colProps)}
                      </Table.Cell>
                    )
                  })}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
        {totalPages > 1 && (
          <div style={{
            padding: '8px',
            border: '1px solid rgba(34, 36, 38, 0.15)',
            borderTop: 0,
            borderRadius: '0px 0px 4px 4px',
            background: '#F9FAFB',
          }}
          >
            <Pagination
              activePage={activePage}
              totalPages={totalPages}
              onPageChange={this.onPageChange}
            />
          </div>
        )}
      </div>
    )
  }
}

DataTable.Column = DataTableColumn

DataTable.propTypes = propTypes
DataTable.defaultProps = defaultProps

export default DataTable
