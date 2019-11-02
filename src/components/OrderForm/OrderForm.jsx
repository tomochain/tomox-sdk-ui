// @flow
import React from 'react'
import { utils } from 'ethers'
import { unformat } from 'accounting-js'
import BigNumber from 'bignumber.js'
import toDecimalFormString from 'number-to-decimal-form-string-x'

import type { Side, OrderType } from '../../types/orders'
import OrderFormRenderer from './OrderFormRenderer'
import { pricePrecision, amountPrecision, fee } from '../../config/tokens'

BigNumber.config({ ROUNDING_MODE: 3 })

type Props = {
  side: Side,
  askPrice: number,
  bidPrice: number,
  baseTokenBalance: number,
  quoteTokenBalance: number,
  baseTokenSymbol: string,
  quoteTokenSymbol: string,
  baseTokenDecimals: number,
  quoteTokenDecimals: number,
  makeFee: string,
  takeFee: string,
  loggedIn: boolean,
  pairIsAllowed: boolean,
  pairAllowanceIsPending: boolean,
  unlockPair: (string, string) => void,
  sendNewOrder: (string, number, number) => void,
}

type State = {
  side: SIDE,
  selectedTabId: OrderType,
  fraction: number,
  priceType: string,
  selectedTabId: string,
  buyPrice: string,
  sellPrice: string,
  stopPrice: string,
  limitPrice: string,
  buyAmount: string,
  sellAmount: string,
  buyTotal: string,
  sellTotal: string,
  isOpen: boolean,
}

class OrderForm extends React.PureComponent<Props, State> {
  static defaultProps = {
    loggedIn: true,
    bidPrice: '',
    askPrice: '',
    baseTokenBalance: '',
    quoteTokenBalance: '',
  }

  state = {
    side: 'BUY',
    fraction: 0,
    isOpen: true,
    priceType: 'null',
    selectedTabId: 'LO',
    buyPrice: '',
    sellPrice: '',
    stopPrice: '',
    limitPrice: '',
    buyAmount: '',
    sellAmount: '',
    buyTotal: '',
    sellTotal: '',
    priceStep: toDecimalFormString(1/Math.pow(10, pricePrecision)),
    amountStep: toDecimalFormString(1/Math.pow(10, amountPrecision)),
    errorBuy: null,
    errorSell: null,
    isShowBuyMaxAmount: false,
    isShowSellMaxAmount: false,
    dirtyPriceForm: false,
  }

  buyPriceInput = React.createRef()
  sellPriceInput = React.createRef()
  buyAmountInput = React.createRef()
  sellAmountInput = React.createRef()

  componentDidUpdate(prevProps) {
    const prevSelectedOrder = prevProps.selectedOrder
    const currSelectedOrder = this.props.selectedOrder
    const { currentPairData } = this.props
    const { dirtyPriceForm } = this.state

    if (!dirtyPriceForm && currentPairData) {
      const price = unformat(currentPairData.price)
      this.setState({ dirtyPriceForm: true })
      return this.setOrderFormPrice(price)  
    }

    if(!prevSelectedOrder && currSelectedOrder) {
      this.resetErrorObject()
      const price = unformat(currSelectedOrder.price)
      return this.setOrderFormPrice(price)      
    }

    if (prevSelectedOrder && prevSelectedOrder.price !== currSelectedOrder.price) {
      this.resetErrorObject()
      const price = unformat(currSelectedOrder.price)
      return this.setOrderFormPrice(price)      
    }  
  }

  setOrderFormPrice(price) {
    this.setState({ 
      buyPrice: price, 
      sellPrice: price,
      buyAmount: '',
      sellAmount: '',
      buyTotal: '',
      sellTotal: '',
    })
  }

  onInputChange = (side: SIDE = 'BUY', { target }: Object) => {
    const { loggedIn } = this.props
    let { value } = target

    value = value.replace(/[^0-9.]/g, '').replace(/^0+/g, '0')    
    value = value.match(/^0[1-9]/g) ? value.replace(/^0/, '') : value
    value = value.match(/^\.[1-9]*/g) ? value.replace(/^./, '0.') : value
    value = value.match(/^[0-9]*\.[0-9]*\.$/g) ? value.replace(/.$/, '') : value
    const regex = /^[0-9]*\.[0-9]{8,}$/g
    if (regex.test(value)) return

    switch (target.name) {
      case 'stopPrice':
        this.handleStopPriceChange(value)
        break
      // case 'limitPrice':
      //   this.handleLimitPriceChange(value)
      //   break
      case 'price':
        this.handlePriceChange(value, side)
        break
      // case 'total':
      //   this.handleTotalChange(value)
      //   break
      case 'amount':
        this.handleAmountChange(value, side)
        break
      case 'fraction':
        loggedIn && this.handleUpdateAmountFraction(value, side)
        break
      default:
        break
    }
  }

  handleSendOrder = (side: SIDE) => {
    const { selectedTabId } = this.state
    const error = this.isInvalidInput(side)
    if (error) {
      (side === 'BUY') ? this.setState({ errorBuy: error }) : this.setState({ errorSell: error })
      return
    }

    const { buyPrice, sellPrice, buyAmount, sellAmount } = this.state

    if (side === 'BUY'){
      this.props.sendNewOrder(side, selectedTabId, unformat(buyAmount), unformat(buyPrice))
    } else {
      this.props.sendNewOrder(side, selectedTabId, unformat(sellAmount), unformat(sellPrice))
    }                    
  }

  handleUpdateAmountFraction = (fraction: number, side: SIDE) => {
    const { quoteTokenBalance, baseTokenBalance, authenticated } = this.props
    if (!authenticated) return

    if (side === 'SELL') {
      const { sellPrice } = this.state
      if (!sellPrice) return

      const bigSellAmount = (BigNumber(baseTokenBalance).div(100)).times(fraction)
      const bigSellTotal = BigNumber(sellPrice).times(bigSellAmount)
      const bigSellFee = bigSellTotal.times(fee)
      const bigSellTotalWithoutFee = bigSellTotal.minus(bigSellFee)

      this.setState({
        fraction,
        sellAmount: bigSellAmount.toFixed(amountPrecision),
        sellTotal: bigSellTotalWithoutFee.toFixed(pricePrecision),
      })
    } else {
      const { buyPrice } = this.state
      if (!buyPrice) return

      const bigBuyFee = BigNumber(quoteTokenBalance).times(fee)
      const bigBuyTotal = (BigNumber(quoteTokenBalance).div(100)).times(fraction)
      const bigBuyTotalWithoutFee = bigBuyTotal.minus(bigBuyFee)
      const bigBuyAmount = bigBuyTotalWithoutFee.div(BigNumber(buyPrice))

      this.setState({
        fraction,
        buyAmount: bigBuyAmount.toFixed(amountPrecision),
        buyTotal: bigBuyTotalWithoutFee.toFixed(pricePrecision),
      })
    }
  }

  handlePriceChange = (price: string, side: SIDE) => {
    this.resetErrorObject(side)

    if (side === 'BUY') {
      const { buyAmount } = this.state

      if (price && buyAmount) {
        const bigBuyTotal = BigNumber(buyAmount).times(BigNumber(price))

        this.setState({
          buyTotal: bigBuyTotal.toFixed(pricePrecision),
          buyPrice: price,
        })
      } else {
        this.setState({
          buyTotal: '',
          buyPrice: price,
        })
      }
    } else {      
      const { sellAmount } = this.state

      if (price && sellAmount) {
        const bigSellTotal = BigNumber(sellAmount).times(BigNumber(price))

        this.setState({
          sellTotal: bigSellTotal.toFixed(pricePrecision),
          sellPrice: price,
        })
      } else {
        this.setState({
          sellTotal: '',
          sellPrice: price,
        })
      }
    }    
  }

  // handleLimitPriceChange = (limitPrice: string) => {
  //   let { amount, stopPrice } = this.state

  //   amount = unformat(amount)
  //   stopPrice = unformat(stopPrice)

  //   this.setState({
  //     amount,
  //     stopPrice,
  //     limitPrice,
  //   })
  // }

  handleStopPriceChange = (stopPrice: string) => {
    let { amount } = this.state

    amount = unformat(amount)
    const total = amount * unformat(stopPrice)

    this.setState({
      total,
      amount,
      stopPrice,
    })
  }

  handleAmountChange = (amount: string, side: SIDE) => {
    this.resetErrorObject(side)
    const { selectedTabId } = this.state

    if (side === 'BUY') {
      const { buyPrice, stopPrice } = this.state

      if (amount && buyPrice) {
        let bigBuyTotal

        selectedTabId === 'stop'
          ? bigBuyTotal = BigNumber(stopPrice).times(BigNumber(amount))
          : bigBuyTotal = BigNumber(buyPrice).times(BigNumber(amount))

        this.setState({
          buyTotal: bigBuyTotal.toFixed(pricePrecision),
          buyAmount: amount,
          isShowBuyMaxAmount: true,
        })
      } else {
        this.setState({
          buyAmount: amount,
          buyTotal: '',
        })
      }
    } else {
      const { sellPrice, stopPrice } = this.state

      if (amount && sellPrice) {
        let bigSellTotal

        selectedTabId === 'stop'
          ? bigSellTotal = BigNumber(stopPrice).times(BigNumber(amount))
          : bigSellTotal = BigNumber(sellPrice).times(BigNumber(amount))

        this.setState({
          sellTotal: bigSellTotal.toFixed(pricePrecision),
          sellAmount: amount,
          isShowSellMaxAmount: true,
        })
      } else {
        this.setState({
          sellAmount: amount,
          sellTotal: '',
        })
      }
    }
  }

  // handleTotalChange = (total: string) => {
  //   const { selectedTabId } = this.state
  //   let { price, stopPrice } = this.state
  //   let amount

  //   price = unformat(price)
  //   stopPrice = unformat(stopPrice)

  //   if (selectedTabId === 'stop') {
  //     if (stopPrice === 0) {
  //       amount = 0
  //     } else {
  //       amount = unformat(total) / stopPrice
  //     }
  //   } else if (price === 0) {
  //     amount = 0
  //   } else {
  //     amount = unformat(total) / price
  //   }

  //   this.setState({
  //     price,
  //     stopPrice,
  //     amount,
  //     total,
  //   })
  // }

  // handleUnlockPair = () => {
  //   const { baseTokenSymbol, quoteTokenSymbol } = this.props

  //   this.props.unlockPair(baseTokenSymbol, quoteTokenSymbol)
  // }

  handleChangeOrderType = (tabId: string) => {
    const { askPrice, bidPrice, side } = this.props

    this.setState({
      selectedTabId: tabId,
      fraction: 0,
      priceType: 'null',
      price: '',
      stopPrice: '',
      limitPrice: '',
      amount: '',
      total: '',
    })

    if (tabId === 'limit' && side === 'BUY') {
      this.setState({ price: askPrice })
    } else if (tabId === 'limit') {
      this.setState({ price: bidPrice })
    } else if (tabId === 'market' && side === 'BUY') {
      this.setState({ price: askPrice })
    } else if (tabId === 'market') {
      this.setState({ price: bidPrice })
    }
  }

  handleDecreasePrice = (event, side: SIDE) => {
    event.preventDefault()

    let {
      state: {
        buyPrice, 
        sellPrice, 
        buyAmount, 
        sellAmount, 
        priceStep
      },
      buyPriceInput,
      sellPriceInput,
    } = this

    if (side === 'BUY') {
      buyPriceInput.current.focus()

      buyPrice = buyPrice ? buyPrice : 0
      let bigBuyPrice = BigNumber(buyPrice).minus(BigNumber(priceStep))
      bigBuyPrice = bigBuyPrice.gt(BigNumber(priceStep)) ? bigBuyPrice : BigNumber(priceStep)

      if (buyPrice && buyAmount) {
        const bigBuyTotal = bigBuyPrice.times(buyAmount)

        this.setState({
          buyPrice: bigBuyPrice.toFixed(pricePrecision),
          buyTotal: bigBuyTotal.toFixed(pricePrecision),
        })
      } else {
        this.setState({
          buyPrice: bigBuyPrice.toFixed(pricePrecision),
          buyTotal: '',
        })
      }
    } else {
      sellPriceInput.current.focus()

      sellPrice = sellPrice ? sellPrice : 0
      let bigSellPrice = BigNumber(sellPrice).minus(BigNumber(priceStep))
      bigSellPrice = bigSellPrice.gt(BigNumber(priceStep)) ? bigSellPrice : BigNumber(priceStep)

      if (sellPrice && sellAmount) {
        const bigSellTotal = bigSellPrice.times(BigNumber(sellAmount))

        this.setState({
          sellPrice: bigSellPrice.toFixed(pricePrecision),
          sellTotal: bigSellTotal.toFixed(pricePrecision),
        })
      } else {
        this.setState({
          sellPrice: bigSellPrice.toFixed(pricePrecision),
          sellTotal: '',
        })
      }
    }
  }

  handleIncreasePrice = (event, side: SIDE) => {
    event.preventDefault()

    let {
      state: {
        buyPrice, 
        sellPrice, 
        buyAmount, 
        sellAmount, 
        priceStep
      },
      buyPriceInput,
      sellPriceInput,
    } = this

    if (side === 'BUY') {
      buyPriceInput.current.focus()

      buyPrice = buyPrice ? buyPrice : 0
      const bigBuyPrice = BigNumber(buyPrice).plus(BigNumber(priceStep))

      if (buyPrice && buyAmount) {
        const bigBuyTotal = bigBuyPrice.times(BigNumber(buyAmount))

        this.setState({
          buyPrice: bigBuyPrice.toFixed(pricePrecision),
          buyTotal: bigBuyTotal.toFixed(pricePrecision),
        })
      } else {
        this.setState({
          buyPrice: bigBuyPrice.toFixed(pricePrecision),
          buyTotal: '',
        })
      }
    } else {
      sellPriceInput.current.focus()

      sellPrice = sellPrice ? sellPrice : 0
      const bigSellPrice = BigNumber(sellPrice).plus(BigNumber(priceStep))

      if (sellPrice && sellAmount) {
        const bigSellTotal = bigSellPrice.times(BigNumber(sellAmount))

        this.setState({
          sellPrice: bigSellPrice.toFixed(pricePrecision),
          sellTotal: bigSellTotal.toFixed(pricePrecision),
        })
      } else {
        this.setState({
          sellPrice: bigSellPrice.toFixed(pricePrecision),
          sellTotal: '',
        })
      }
    }
  }

  handleDecreaseAmount = (event, side: SIDE) => {
    event.preventDefault()

    let {
      state: {
        buyAmount, 
        sellAmount, 
        buyPrice, 
        sellPrice, 
        amountStep
      },
      buyAmountInput,
      sellAmountInput,
    } = this

    if (side === 'BUY') {
      buyAmountInput.current.focus()

      buyAmount = buyAmount ? buyAmount : 0
      let bigBuyAmount = BigNumber(buyAmount).minus(BigNumber(amountStep)) 
      bigBuyAmount = bigBuyAmount.gt(BigNumber(amountStep)) ? bigBuyAmount : BigNumber(amountStep)

      if (buyAmount && buyPrice) {
        const bigBuyTotal = bigBuyAmount.times(BigNumber(buyPrice))

        this.setState({
          buyAmount: bigBuyAmount.toFixed(amountPrecision),
          buyTotal: bigBuyTotal.toFixed(amountPrecision),
        })
      } else {
        this.setState({
          buyAmount: bigBuyAmount.toFixed(amountPrecision),
          buyTotal: '',
        })
      }
    } else {
      sellAmountInput.current.focus()

      sellAmount = sellAmount ? sellAmount : 0
      let bigSellAmount = BigNumber(sellAmount).minus(BigNumber(amountStep))
      bigSellAmount = bigSellAmount.gt(BigNumber(amountStep)) ? bigSellAmount : BigNumber(amountStep)

      if (sellAmount && sellPrice) {
        const bigSellTotal = bigSellAmount.times(BigNumber(sellPrice))
        
        this.setState({
          sellAmount: bigSellAmount.toFixed(amountPrecision),
          sellTotal: bigSellTotal.toFixed(amountPrecision),
        })
      } else {
        this.setState({
          sellAmount: bigSellAmount.toFixed(amountPrecision),
          sellTotal: '',
        })
      }
    }
  }

  handleIncreaseAmount = (event, side: SIDE) => {
    event.preventDefault()

    let {
      state: {
        buyAmount, 
        sellAmount, 
        buyPrice, 
        sellPrice, 
        amountStep
      }, 
      buyAmountInput, 
      sellAmountInput,
    } = this

    buyPrice = buyPrice ? buyPrice : 0
    sellPrice = sellPrice ? sellPrice : 0
    buyAmount = buyAmount ? buyAmount : 0
    sellAmount = sellAmount ? sellAmount : 0 

    if (side === 'BUY') {
      buyAmountInput.current.focus()

      buyAmount = buyAmount ? buyAmount : 0
      const bigBuyAmount = BigNumber(buyAmount).plus(BigNumber(amountStep))

      if (buyAmount && buyPrice) {
        const bigBuyTotal = bigBuyAmount.times(BigNumber(buyPrice))

        this.setState({
          buyAmount: bigBuyAmount.toFixed(amountPrecision),
          buyTotal: bigBuyTotal.toFixed(amountPrecision),
        })
      } else {
        this.setState({
          buyAmount: bigBuyAmount.toFixed(amountPrecision),
          buyTotal: '',
        })
      }
    } else {
      sellAmountInput.current.focus()

      sellAmount = sellAmount ? sellAmount : 0 
      const bigSellAmount = BigNumber(sellAmount).plus(BigNumber(amountStep))

      if (sellAmount && sellPrice) {
        const bigSellTotal = bigSellAmount.times(BigNumber(sellPrice))

        this.setState({
          sellAmount: bigSellAmount.toFixed(amountPrecision),
          sellTotal: bigSellTotal.toFixed(amountPrecision),
        })
      } else {
        this.setState({
          sellAmount: bigSellAmount.toFixed(amountPrecision),
          sellTotal: '',
        })
      }
    }
  }

  isInvalidInput(side: SIDE) {
    const { 
      buyPrice, 
      sellPrice, 
      buyAmount, 
      sellAmount, 
    } = this.state

    const {
      makeFee,
      quoteTokenDecimals,
      quoteTokenBalance,
      baseTokenBalance,
    } = this.props

    const formattedMakeFee = makeFee && utils.formatUnits(makeFee, quoteTokenDecimals)
    const maxQuoteTokenAmount = quoteTokenBalance - Number(formattedMakeFee)
    const buyMaxAmount = maxQuoteTokenAmount / unformat(buyPrice)
    const sellMaxAmount = Number(baseTokenBalance)

    if (side === 'BUY') { 
      switch (true) {
        case (unformat(buyPrice) === 0):
          return {
            type: 'price',
            message: 'Please input price',
          }

        case (unformat(buyAmount) === 0):
          return {
            type: 'amount',
            message: 'Please input amount',
          }
        case (buyAmount > buyMaxAmount):
          return {
            type: 'total',
            message: 'Your balance is not enough',
          }
        default:
          return null 
      }
    } else {
      switch(true) {
        case (unformat(sellPrice) === 0):
          return {
            type: 'price',
            message: 'Please input price',
          }
        case (unformat(sellAmount) === 0):
          return {
            type: 'amount',
            message: 'Please input amount',
          }
        case (sellAmount > sellMaxAmount):
          return {
            type: 'total',
            message: 'Your balance is not enough',
          }
        default:
          return null
      }
    }
  }

  resetErrorObject = (side: SIDE) => {
    switch (side) {
      case 'BUY':
        this.setState({
          errorBuy: null,
        })

        break
      case 'SELL':
        this.setState({
          errorSell: null,
        })

        break
      default:
        this.setState({
          errorBuy: null,
          errorSell: null,
        })
    }
  }

  onInputFocus = (side: SIDE, { target }: Object) => {
    if (target.name === 'amount') {
      (side === 'BUY') ? this.setState({ isShowBuyMaxAmount: true }) : this.setState({ isShowSellMaxAmount: true })
    }
  }

  onInputBlur = (side: SIDE, { target }: Object) => {
    if (target.name === 'amount') {
      (side === 'BUY') ? this.setState({ isShowBuyMaxAmount: false }) : this.setState({ isShowSellMaxAmount: false })
    }
  }

  render() {
    const {
      state: {
        side,
        selectedTabId,
        fraction,
        priceType,
        buyPrice,
        sellPrice,
        isOpen,
        stopPrice,
        limitPrice,
        buyAmount,
        sellAmount,
        buyTotal,
        sellTotal,
        errorBuy,
        errorSell,
        isShowBuyMaxAmount,
        isShowSellMaxAmount,
      },
      props: {
        baseTokenSymbol,
        quoteTokenSymbol,
        baseTokenDecimals,
        quoteTokenDecimals,
        loggedIn,
        pairIsAllowed,
        pairAllowanceIsPending,
        makeFee,
        takeFee,
        baseTokenBalance,
        quoteTokenBalance,
        authenticated,
        redirectToLoginPage,
        loading,
      },
      onInputChange,
      onInputFocus,
      onInputBlur,
      handleChangeOrderType,
      handleUnlockPair,
      toggleCollapse,
      handleSendOrder,
      handleSideChange,
      handleDecreasePrice,
      handleIncreasePrice,
      handleDecreaseAmount,
      handleIncreaseAmount,
      buyPriceInput,
      sellPriceInput,
      buyAmountInput,
      sellAmountInput,
    } = this

    let buyMaxAmount = 0
    let sellMaxAmount = 0

    if (authenticated) {
      if (unformat(buyPrice) & quoteTokenBalance) {
        const formattedMakeFee = makeFee && utils.formatUnits(makeFee, quoteTokenDecimals)
        const maxQuoteTokenAmount = BigNumber(quoteTokenBalance).minus(formattedMakeFee)
        buyMaxAmount = maxQuoteTokenAmount.div(BigNumber(buyPrice)).toFixed(amountPrecision)
      }

      sellMaxAmount = BigNumber(baseTokenBalance).toFixed(amountPrecision)
    }

    const insufficientBalanceToBuy = (unformat(buyAmount) > unformat(buyMaxAmount))
    const insufficientBalanceToSell = (unformat(sellAmount) > unformat(sellMaxAmount))

    return (
      <OrderFormRenderer
        selectedTabId={selectedTabId}
        side={side}
        fraction={fraction}
        priceType={priceType}
        buyPrice={buyPrice}
        sellPrice={sellPrice}
        stopPrice={stopPrice}
        limitPrice={limitPrice}
        buyAmount={buyAmount}
        sellAmount={sellAmount}
        buyMaxAmount={buyMaxAmount}
        sellMaxAmount={sellMaxAmount}
        buyTotal={buyTotal}
        sellTotal={sellTotal}
        isOpen={isOpen}
        makeFee={makeFee}
        takeFee={takeFee}
        baseTokenSymbol={baseTokenSymbol}
        quoteTokenSymbol={quoteTokenSymbol}
        baseTokenDecimals={baseTokenDecimals}
        quoteTokenDecimals={quoteTokenDecimals}
        loggedIn={loggedIn}
        insufficientBalanceToBuy={insufficientBalanceToBuy}
        insufficientBalanceToSell={insufficientBalanceToSell}
        pairIsAllowed={pairIsAllowed}
        pairAllowanceIsPending={pairAllowanceIsPending}
        onInputChange={onInputChange}
        onInputFocus={onInputFocus}
        onInputBlur={onInputBlur}
        handleUnlockPair={handleUnlockPair}
        toggleCollapse={toggleCollapse}
        handleChangeOrderType={handleChangeOrderType}
        handleSendOrder={handleSendOrder}
        handleSideChange={handleSideChange}
        handleDecreasePrice={handleDecreasePrice}
        handleIncreasePrice={handleIncreasePrice}
        handleDecreaseAmount={handleDecreaseAmount}
        handleIncreaseAmount={handleIncreaseAmount}
        errorBuy={errorBuy}
        errorSell={errorSell}
        isShowBuyMaxAmount={isShowBuyMaxAmount}
        isShowSellMaxAmount={isShowSellMaxAmount}
        buyPriceInput={buyPriceInput}
        sellPriceInput={sellPriceInput}
        buyAmountInput={buyAmountInput}
        sellAmountInput={sellAmountInput}
        authenticated={authenticated}
        redirectToLoginPage={redirectToLoginPage}
        loading={loading}
      />
    )
  }
}

export default OrderForm
