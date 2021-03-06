/* eslint-disable */
import React from 'react'
import PropTypes from 'prop-types'


const propTypes = {
  name: PropTypes.string.isRequired,
  dataKey: PropTypes.string,
  searchable: PropTypes.bool,
  pickable: PropTypes.bool,
  format: PropTypes.string,
  nullTemplate: PropTypes.string,
  template: PropTypes.func,
  sortable: PropTypes.bool,
  /** Use basic for number */
  sortType: PropTypes.oneOf(['basic', 'string', 'date']),
}

const defaultProps = {
  searchable: false,
  pickable: false,
  format: null,
  template: null,
  nullTemplate: null,
  sortable: true,
}

class DataTableColumn extends React.Component { }

DataTableColumn.propTypes = propTypes
DataTableColumn.defaultProps = defaultProps

export default DataTableColumn
export { propTypes, defaultProps }
