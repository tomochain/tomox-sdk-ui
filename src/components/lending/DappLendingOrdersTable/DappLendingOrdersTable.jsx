//@flow
import React from 'react'
import BigNumber from 'bignumber.js'

import { sortTable } from '../../../utils/helpers'
import type { Order } from '../../../types/orders'

import DappLendingOrdersTableRenderer from './DappLendingOrdersTableRenderer'

type Props = {
  orders: Array<Order>,
  authenticated: false,
  cancelOrder: string => void
};

type State = {
  selectedTabId: string,
  isHideOtherPairs: boolean,
};

class DappLendingOrdersTable extends React.PureComponent<Props, State> {
  static defaultProps = { authenticated: true }
  state = {
    selectedTrade: null,
    selectedPanel: 'orders',
    selectedTabId: 'open-orders',
    isHideOtherPairs: false,
    selectedCollateral: {},
    topUpAmount: '',
    errorTopUp: null,
    errorRepay: false,
    realInterest: '',
    lendingToken: '',
  }

  handleChangePanel = (panelId: string) => {
    this.setState({ selectedPanel: panelId })
  }

  changeTab = (tabId: string) => {
    this.setState({ selectedTabId: tabId })
  }

  handleChangeHideOtherPairs = () => {
    this.setState({
      isHideOtherPairs: !this.state.isHideOtherPairs,
    })
  }

  filterOrders = () => {
    const { orders, currentPair: { pair }} = this.props
    const { isHideOtherPairs } = this.state
    const result = {processing: [], finished: []}

    result['finished'] = orders.filter(order => {
      return (order.status === 'FILLED' || order.status === 'CANCELLED'|| order.status === 'REJECTED')
    })

    result['processing'] = orders.filter(order => {
      return (order.status !== 'FILLED' && order.status !== 'CANCELLED' && order.status !== 'REJECTED')
    })

    for (const property in result) {
      result[property] = sortTable(result[property], 'time', (a, b) => {
        // sort by DESC
        return a < b ? 1 : -1
      })
    }

    if (isHideOtherPairs) {
      for (const property in result) {
        result[property] = result[property].filter(order => order.pair === pair)
      }

      return result
    }

    return result
  }

  filterTrades = () => {
    const { trades, currentPair: { termSymbol, lendingTokenSymbol }} = this.props
    const { isHideOtherPairs } = this.state
    const result = {processing: [], finished: []}

    result['finished'] = trades.filter(trade => {
      return (trade.status !== 'OPEN')
    })

    result['processing'] = trades.filter(trade => {
      return (trade.status === 'OPEN')
    })

    for (const property in result) {
      result[property] = sortTable(result[property], 'time', (a, b) => {
        // sort by DESC
        return a < b ? 1 : -1
      })
    }

    if (isHideOtherPairs) {
      for (const property in result) {
        result[property] = result[property].filter(order => (order.termSymbol === termSymbol) && (order.lendingTokenSymbol === lendingTokenSymbol))
      }

      return result
    }

    return result
  }

  handleSelectTrade = (trade: Object) => {
    const { collaterals } = this.props
    const collateral = collaterals.find(collateral => collateral.address.toLowerCase() === trade.collateralToken.toLowerCase())
    
    this.setState({
      selectedTrade: {...trade, collateral},
    })
  }

  closeDetailsPanel = (trade: Object) => {
    this.setState({
      selectedTrade: null,
    })
  }

  selectAllAvailableBalance = _ => {
    const { selectedTrade } = this.state

    this.setState({
      topUpAmount: (selectedTrade && selectedTrade.collateral) ? selectedTrade.collateral.availableBalance : 0,
      errorTopUp: null,
    })
  }

  handleChangeTopUpAmount = (e) => {
    this.setState({
      topUpAmount: e.target.value,
      errorTopUp: null,
    })
  }

  handleTopUp = (hash: String) => {
    const { selectedTrade, topUpAmount } = this.state
    const collateralAvailable = (selectedTrade && selectedTrade.collateral) ? selectedTrade.collateral.availableBalance : 0
    
    if (!topUpAmount) return this.setState({errorTopUp: {message: 'Please enter amount'}})
    if (BigNumber(collateralAvailable).lt(topUpAmount)) return this.setState({errorTopUp: {message: 'Balance not enough'}})

    const collateral = {...selectedTrade.collateral, amount: topUpAmount}
    this.props.topUpLendingOrder({hash, collateral})
  }

  render() {
    const { authenticated, orders, cancelOrder } = this.props
    const { 
      selectedPanel, 
      selectedTrade, 
      selectedTabId, 
      isHideOtherPairs,
      topUpAmount,
      errorTopUp,
    } = this.state
    const filteredOrders = this.filterOrders()
    const filteredTrades = this.filterTrades()
    const loading = !orders

    return (
      <DappLendingOrdersTableRenderer
        loading={loading}
        selectedTabId={selectedTabId}
        onChange={this.changeTab}
        toggleCollapse={this.toggleCollapse}
        authenticated={authenticated}
        cancelOrder={cancelOrder}
        orders={filteredOrders}
        trades={filteredTrades}
        isHideOtherPairs={isHideOtherPairs}
        handleChangeHideOtherPairs={this.handleChangeHideOtherPairs}
        selectedPanel={selectedPanel}
        handleChangePanel={this.handleChangePanel}
        selectedTrade={selectedTrade}
        handleSelectTrade={this.handleSelectTrade}
        closeDetailsPanel={this.closeDetailsPanel}
        topUpAmount={topUpAmount}
        handleChangeTopUpAmount={this.handleChangeTopUpAmount}
        handleTopUp={this.handleTopUp}
        errorTopUp={errorTopUp}
        selectAllAvailableBalance={this.selectAllAvailableBalance}
      />
    )
  }
}

export default DappLendingOrdersTable
