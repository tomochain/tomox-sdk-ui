// @flow
import BigNumber from 'bignumber.js'

import * as appActionCreators from '../../actions/app'
import { 
  getLendingOrdersDomain, 
  getLendingTradesDomain, 
  getAccountDomain, 
  getTokenPairsDomain,
  getLendingTokensDomain,
  getAccountBalancesDomain,
} from '../../domains'
import type { State, ThunkAction } from '../../types'

import { 
  getTopupLendingHash,
  getRepayLendingHash,
  getLendingCancelHash,
} from '../../../utils/crypto'
import { parseCancelOrderError } from '../../../config/errors'
import { getSigner } from '../../services/signer'

export default function ordersTableSelector(state: State) {
  const accountDomain = getAccountDomain(state)
  const address = accountDomain.address()
  const authenticated = accountDomain.authenticated()
  const orders = getLendingOrdersDomain(state).lastOrders(100)
  const trades = getLendingTradesDomain(state).userTrades(address)
  const currentPair = getTokenPairsDomain(state).getCurrentPair()
  const currentPairData = getTokenPairsDomain(state).getCurrentPairData()
  const lendingTokensDomain = getLendingTokensDomain(state)
  let collaterals = lendingTokensDomain.collaterals()
  collaterals = getAccountBalancesDomain(state).getBalancesAndAllowances(collaterals)

  return {
    orders,
    trades,
    currentPair,
    currentPairData,
    authenticated,
    collaterals,
  }
}

export const cancelLendingOrder = (hash): ThunkAction => {
  return async (dispatch, getState, { socket, api }) => {
    try {
      const state = getState()
      const order = getLendingOrdersDomain(state).getOrderByHash(hash)
      const accountDomain = getAccountDomain(state)
      const userAddress = accountDomain.address()
      const exchangeAddress = accountDomain.exchangeAddress()
      const nonce = await api.getLendingOrderNonce(userAddress)

      let params = {
        userAddress,
        relayerAddress: exchangeAddress,
        lendingToken: order.lendingToken,
        term: order.term,
        lendingId: order.lendingId,
        status: 'CANCELLED',
        hash: order.hash,
      }

      params.nonce = String(nonce)
      const orderHashed = getLendingCancelHash(params)
      params.signature = await getSigner().signLendingCancelOrder(orderHashed)

      api.cancelLendingOrder(params)
      dispatch(appActionCreators.addSuccessNotification({ message: `Cancelling lending order...` }))
    } catch (error) {
      const message = parseCancelOrderError(error)
      return dispatch(appActionCreators.addErrorNotification({ message }))
    }
  }
}

export const topUpLendingOrder = ({hash, collateral}): ThunkAction => {
  return async (dispatch, getState, { socket, api }) => {
    try {
      const state = getState()
      const trade = getLendingTradesDomain(state).byAddress()[hash]
      const accountDomain = getAccountDomain(state)
      const userAddress = accountDomain.address()
      const exchangeAddress = accountDomain.exchangeAddress()
      const nonce = await api.getLendingOrderNonce(userAddress)

      let params = {
        userAddress,
        relayerAddress: exchangeAddress,
        lendingToken: trade.lendingToken,
        term: trade.term,
        tradeId: trade.tradeID,
        status: 'TOPUP',
      }

      params.quantity = BigNumber(collateral.amount)
                    .multipliedBy(10 ** collateral.decimals).toString(10)

      params.nonce = String(nonce)

      params.hash = getTopupLendingHash(params)
      const orderSigned = await getSigner().signLendingOrder(params)

      dispatch(appActionCreators.addSuccessNotification({ message: `Top up lending order...` }))
      await api.topUpLendingOrder(orderSigned)
    } catch (error) {
      console.log(error)
      const message = parseCancelOrderError(error)
      return dispatch(appActionCreators.addErrorNotification({ message }))
    }
  }
}

export const repayLendingOrder = (hash): ThunkAction => {
  return async (dispatch, getState, { socket, api }) => {
    try {      
      const state = getState()
      const accountDomain = getAccountDomain(state)
      const exchangeAddress = accountDomain.exchangeAddress()
      const userAddress = accountDomain.address()
      const trade = getLendingTradesDomain(state).byAddress()[hash]
      const nonce = await api.getLendingOrderNonce(userAddress)      

      let params = {
        userAddress,
        relayerAddress: exchangeAddress,
        lendingToken: trade.lendingToken,
        term: trade.term,
        tradeId: trade.tradeID,
        status: 'REPAY',
      }

      params.nonce = String(nonce)    
      params.hash = getRepayLendingHash(params)
      const orderSigned = await getSigner().signLendingOrder(params)

      dispatch(appActionCreators.addSuccessNotification({ message: `Repaying lending order...` }))
      await api.repayLendingOrder(orderSigned)
    } catch (e) {
      console.log(e)
      const message = parseCancelOrderError(e)
      return dispatch(appActionCreators.addErrorNotification({ message }))
    }
  }
}
