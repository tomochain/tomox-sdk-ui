import React from 'react'
import styled from 'styled-components'
import { FormattedMessage } from 'react-intl'

import { TmColors, SmallText, ButtonLogin } from '../../components/Common'
import pantographUrl from '../../assets/images/pantograph.png'

type Props = {
    unlockWallet: void => void,
    error: Object,
}

const PantographRenderer = (props: Props) => {
    const { 
        unlockWallet,
        error,
    } = props
  
    return (
      <Wrapper>
        <Centered><img width="130px" src={pantographUrl} alt="Pantograph" /></Centered>
        {!error && (
            <Note>
                <FormattedMessage 
                    id="unlockWalletPage.metaMaskNote"
                    values={{
                        metamaskLink: (<a href="https://chrome.google.com/webstore/detail/pantograph/ocfgfhicacgipgpiapepehhpidbhijkl?hl" target="_blank" rel="noopener noreferrer">Pantograph Extension</a>),
                        mainnetLink: (<a href="https://docs.tomochain.com/developer-guide/working-with-tomochain/tomochain-mainnet" target="_blank" rel="noopener noreferrer">Tomochain Mainnet</a>),
                        testnetLink: (<a href="https://docs.tomochain.com/developer-guide/working-with-tomochain/tomochain-testnet" target="_blank" rel="noopener noreferrer">Testnet</a>),
                    }} />
            </Note>
        )}

        {error && (
            <React.Fragment>
                <ErrorMessage><FormattedMessage id="unlockWalletPage.pantographError1" /></ErrorMessage>
                <ErrorMessage><FormattedMessage id="unlockWalletPage.pantographError2" /></ErrorMessage>
            </React.Fragment>
        )}
        <ButtonLogin onClick={unlockWallet}><FormattedMessage id="unlockWalletPage.unlockWallet" /></ButtonLogin>
      </Wrapper>
    )
}

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 395px;
    margin: 0 auto;
`

const Centered = styled.div`
    display: flex;
    justify-content: center;
    margin-bottom: 50px;
`

const Note = styled(SmallText)`
    line-height: 20px;
    text-align: center;

    a {
        color: ${TmColors.ORANGE};
        &:hover {
            color: ${TmColors.DARK_ORANGE};
        }
    }
`

const ErrorMessage = styled.div`
    color: ${TmColors.RED};
    font-size: 12px;
    margin-top: 7px;
`

export default PantographRenderer

