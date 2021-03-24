import React, { useContext, useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useHistory } from 'react-router-dom';
import { ethers } from 'ethers';
import QrReader from 'react-qr-reader';

import { AppContext } from '../../contexts/AppContext';
import Loading from '../global/Loading';
import AppHeader from '../layouts/AppHeader';
import ModalWrapper from '../global/ModalWrapper';
import { APP_CONSTANTS } from '../../constants';
import Contract from '../../utils/blockchain/contract';
import DataService from '../../services/db';

const { SCAN_DELAY, SCANNER_PREVIEW_STYLE, SCANNER_CAM_STYLE } = APP_CONSTANTS;

export default function Index(props) {
	const { saveScannedAddress, saveSendingTokenName, network, wallet } = useContext(AppContext);
	let history = useHistory();

	let tokenAddress = props.match.params.address;

	const [tokenDetails, setTokenDetails] = useState(null);

	const [sendAmount, setSendAmount] = useState('');
	const [sendToAddress, setSendToAddress] = useState('');
	const [loadingModal, setLoadingModal] = useState(false);
	const [scanModal, setScanModal] = useState(false);
	const [sendingToken, setSendingTokenSymbol] = useState('');

	const handleScanModalToggle = () => setScanModal(!scanModal);

	const handleScanError = err => {
		alert('Oops, scanning failed. Please try again');
	};
	const handlScanSuccess = data => {
		if (data) {
			try {
				const initials = data.substring(0, 2);
				if (initials === '0x') {
					saveScannedAddress({ address: data });
					handleScanModalToggle();
					history.push('/select-token');
					return;
				}
				let properties = data.split(',');
				let obj = {};
				properties.forEach(function (property) {
					let tup = property.split(':');
					obj[tup[0]] = tup[1].trim();
				});
				const tokenName = Object.getOwnPropertyNames(obj)[0];
				obj.address = obj[tokenName];
				saveTokenNameToCtx(tokenName);
				saveScannedAddress(obj);
				handleScanModalToggle();
				history.push('/transfer');
			} catch (err) {
				handleScanModalToggle();
				Swal.fire('ERROR', 'Invalid wallet address!', 'error');
			}
		}
	};

	const saveTokenNameToCtx = tokenName => {
		if (tokenName === 'ethereum') saveSendingTokenName('ethereum');
		else saveSendingTokenName(tokenName);
	};

	const handleSendToChange = e => {
		setSendToAddress(e.target.value);
	};

	const handleSendAmtChange = e => {
		setSendAmount(e.target.value);
	};

	const resetFormStates = () => {
		setLoadingModal(false);
		setSendAmount('');
		setSendingTokenSymbol('');
		setSendToAddress('');
	};

	const sendERCSuccess = (sendAmount, sendToAddress) => {
		Swal.fire({
			title: 'Success',
			html: `You sent <b>${sendAmount}</b> ${sendingToken} to <b>${sendToAddress}</b>.`,
			icon: 'success',
			confirmButtonColor: '#3085d6',
			cancelButtonColor: '#d33',
			confirmButtonText: 'Okay'
		}).then(result => {
			if (result.value) {
				history.push('/assets');
			}
		});
	};

	const sendSuccess = (data, receipt) => {
		resetFormStates();
		Swal.fire({
			title: 'Success',
			html: `You sent <b>${data.sendAmount}</b> ethers to <b>${data.sendToAddress}</b>.<br>
      Your confirmation code is <b>${receipt.hash}</b>.<br>So far your account has completed ${
				receipt.nonce + 1
			} transactions.`,
			icon: 'success',
			confirmButtonColor: '#3085d6',
			cancelButtonColor: '#d33',
			confirmButtonText: 'Okay'
		}).then(result => {
			if (result.value) {
				history.push('/assets');
			}
		});
	};

	const confirmAndSend = async data => {
		const isConfirm = await Swal.fire({
			title: 'Are you sure?',
			html: `You are sending <b>${data.sendAmount} ${sendingToken}</b> to <b>${data.sendToAddress}</b>.<br><small>Please double check the address and the amount.</small>`,
			showCancelButton: true,
			confirmButtonColor: '#3085d6',
			cancelButtonColor: '#d33',
			confirmButtonText: 'Yes',
			cancelButtonText: 'No'
		});
		if (isConfirm.value) {
			send(data);
		}
	};

	const send = async data => {
		try {
			if (!ethers.utils.isAddress(data.sendToAddress)) throw Error('Destination address is invalid');
			setLoadingModal(true);
			setTimeout(async () => {
				try {
					if (tokenDetails.address === 'default') await sendEther(data);
					else await sendERCToken();
				} catch (e) {
					Swal.fire('ERROR', e.error.message, 'error');
				} finally {
					resetFormStates();
				}
			}, 250);
		} catch (e) {
			Swal.fire('ERROR', e.message, 'error');
		}
	};

	const sendERCToken = async () => {
		try {
			const tokenContract = Contract({ wallet, address: tokenDetails.address, type: tokenDetails.type }).get();
			await tokenContract.transfer(sendToAddress, sendAmount);
			sendERCSuccess(sendAmount, sendToAddress);
		} catch (err) {
			Swal.fire('ERROR', err.message, 'error');
		}
	};

	const sendEther = async data => {
		try {
			const receipt = await wallet.sendTransaction({
				to: data.sendToAddress,
				value: ethers.utils.parseEther(data.sendAmount.toString())
			});
			sendSuccess(data, receipt);
		} catch (err) {
			Swal.fire('ERROR', err.message, 'error');
		}
	};

	const handleSendClick = () => {
		if (!sendAmount || !sendToAddress) {
			return Swal.fire({ title: 'ERROR', icon: 'error', text: 'Send amount and receiver address is required' });
		}
		confirmAndSend({ sendAmount, sendToAddress });
	};

	useEffect(() => {
		(async () => {
			const token = await DataService.getAsset(tokenAddress);
			if (token) setTokenDetails(token);
			else {
				Swal.fire('ERROR', 'Asset not found.', 'error').then(a => {
					history.push('/assets');
				});
			}
		})();
	}, [history, tokenAddress]);

	// useEffect(() => {
	// 	const _tokens = [];
	// 	//setTokenAssets(_tokens);
	// 	//sendingTokenName => Scanned token name
	// 	if (true == false && sendingTokenName) {
	// 		const found = _tokens.find(item => item.tokenName === sendingTokenName);
	// 		if (found) {
	// 			setSendingTokenSymbol(found.symbol);
	// 			setCurrentBalance(found.tokenBalance);
	// 		} else {
	// 			if (sendingTokenName === 'ethereum') {
	// 				setSendingTokenSymbol(DEFAULT_TOKEN.SYMBOL);
	// 				setCurrentBalance(ethBalance);
	// 			} else {
	// 				setSendingTokenSymbol('');
	// 				Swal.fire({
	// 					title: 'Asset not available',
	// 					text: `Would you like to add ${sendingTokenName} asset now?`,
	// 					showCancelButton: true,
	// 					confirmButtonColor: '#3085d6',
	// 					cancelButtonColor: '#d33',
	// 					confirmButtonText: 'Yes',
	// 					cancelButtonText: 'No'
	// 				}).then(res => {
	// 					if (res.isConfirmed) history.push('/import-token');
	// 				});
	// 			}
	// 		}
	// 	}

	// 	scannedEthAddress && setSendToAddress(scannedEthAddress);
	// 	scannedAmount && setSendAmount(scannedAmount);
	// }, [ethBalance, history, scannedAmount, scannedEthAddress, sendingTokenName]);

	return (
		<>
			<ModalWrapper title="Scan a QR Code" showModal={scanModal} handleModal={handleScanModalToggle}>
				<div style={SCANNER_CAM_STYLE}>
					<QrReader
						delay={SCAN_DELAY}
						style={SCANNER_PREVIEW_STYLE}
						onError={handleScanError}
						onScan={handlScanSuccess}
					/>
				</div>
			</ModalWrapper>
			<Loading showModal={loadingModal} message="Transferring tokens. Please wait..." />
			<AppHeader currentMenu="Transfer" />
			<div id="appCapsule">
				<div id="cmpMain">
					<div className="section mt-2 mb-5">
						<div className="wide-block pt-2 pb-2">
							<div className="alert alert-primary mb-1" role="alert" style={{ fontSize: '1rem' }}>
								Token Name : <strong>{tokenDetails && tokenDetails.name}</strong> <br />
								Current Balance : <strong>{tokenDetails && tokenDetails.balance}</strong> <br />
								Current Network : <strong>{network && network.display}</strong>
							</div>
						</div>

						<div className="card mt-5" id="cmpTransfer">
							<div className="card-body">
								<form>
									<div className="form-group boxed" style={{ padding: 0 }}>
										<div className="input-wrapper">
											<label className="label" htmlFor="sendToAddr">
												Destination Address:
											</label>
											<div className="input-group mb-3">
												<input
													type="text"
													className="form-control"
													id="sendToAddr"
													name="sendToAddr"
													placeholder="Enter receiver's address"
													onChange={handleSendToChange}
													value={sendToAddress}
												/>
												<i className="clear-input">
													<ion-icon
														name="close-circle"
														role="img"
														className="md hydrated"
														aria-label="close circle"
													/>
												</i>
												<div className="ml-1">
													<button
														type="button"
														className="btn btn-icon btn-primary mr-1 mb-1 btn-scan-address"
														onClick={handleScanModalToggle}
													>
														<ion-icon name="qr-code-outline" />
													</button>
												</div>
											</div>
										</div>
									</div>
									<div className="form-group boxed" style={{ padding: 0 }}>
										<div className="input-wrapper">
											<label className="label" htmlFor="sendAmount">
												Amount to Send:
											</label>
											<input
												onChange={handleSendAmtChange}
												value={sendAmount}
												type="number"
												className="form-control"
												id="sendAmount"
												name="sendAmount"
												placeholder="Enter amount to send"
											/>
											<i className="clear-input">
												<ion-icon
													name="close-circle"
													role="img"
													className="md hydrated"
													aria-label="close circle"
												/>
											</i>
										</div>
									</div>
									<div className="mt-3">
										<small>
											Important: Please double check the address and amount before sending.
											Transactions cannot be reversed.
										</small>
									</div>
								</form>
							</div>
							<div className="card-footer text-right">
								<button
									type="button"
									id="btnSend"
									className="btn btn-success"
									onClick={handleSendClick}
								>
									<ion-icon name="send-outline" /> Send Now
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
