const axios = require('axios')
const path = require('path')

const Product = require('../models/Product')
const Order = require('../models/Order')
const { getCart, calculateTotals, clearCart } = require('./cartUtils')

const NETS_QR_REQUEST_URL = 'https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/request'
const NETS_QR_QUERY_URL = 'https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/query'
const DEFAULT_TXN_ID = 'sandbox_nets|m|8ff8e5b6-d43e-4786-8ac5-7accf8c5bd9b'
const SSE_POLL_INTERVAL_MS = 3000
const SSE_TIMEOUT_MS = 300000
const NETS_REQUEST_TIMEOUT_MS = 12000

function loadCourseInitId() {
    try {
        const modulePath = path.join(__dirname, '..', 'course_init_id.js')
        const module = require(modulePath)
        return module?.courseInitId || ''
    } catch (error) {
        return ''
    }
}

function getUserId(user = {}) {
    return user?.id
}

function getNetsHeaders() {
    return {
        'api-key': process.env.API_KEY,
        'project-id': process.env.PROJECT_ID
    }
}

async function postWithRetry(url, body, headers, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await axios.post(url, body, {
                headers,
                timeout: NETS_REQUEST_TIMEOUT_MS
            })
        } catch (error) {
            const status = error?.response?.status
            const isRetryable = status === 504 || status === 502 || status === 503 || error?.code === 'ECONNABORTED'
            if (!isRetryable || attempt === retries) {
                throw error
            }
        }
    }

    return null
}

async function queryNetsStatus({ txnRetrievalRef, txnId, txnNetsQrId }) {
    const requestBody = {
        txn_retrieval_ref: txnRetrievalRef
    }
    if (txnId) {
        requestBody.txn_id = txnId
    }
    if (txnNetsQrId) {
        requestBody.txn_nets_qr_id = txnNetsQrId
    }

    const response = await axios.post(NETS_QR_QUERY_URL, requestBody, {
        headers: getNetsHeaders()
    })

    const statusData = response?.data?.result?.data || {}
    const status = classifyTxnStatus(statusData)
    return { status, statusData }
}

function classifyTxnStatus(data = {}) {
    const responseCode = String(data.response_code || '')
    const txnStatus = Number(data.txn_status)
    const paymentStatus = Number(data.payment_status)
    const statusText = String(data.txn_status_desc || '').toLowerCase()
    const paymentText = String(data.payment_status_desc || '').toLowerCase()

    if (responseCode && responseCode !== '00') {
        return 'fail'
    }

    if (
        txnStatus === 1 ||
        paymentStatus === 1 ||
        statusText.includes('success') ||
        statusText.includes('approved') ||
        statusText.includes('completed') ||
        paymentText.includes('success') ||
        paymentText.includes('approved') ||
        paymentText.includes('paid') ||
        paymentText.includes('completed')
    ) {
        return 'success'
    }

    if (
        [3, 4, 5].includes(txnStatus) ||
        statusText.includes('fail') ||
        statusText.includes('decline') ||
        statusText.includes('timeout') ||
        statusText.includes('expired') ||
        statusText.includes('cancel') ||
        paymentText.includes('fail') ||
        paymentText.includes('decline') ||
        paymentText.includes('timeout') ||
        paymentText.includes('expired') ||
        paymentText.includes('cancel')
    ) {
        return 'fail'
    }

    return 'pending'
}

async function finalizeOrderFromSession(req) {
    const cart = getCart(req.session)
    calculateTotals(cart)

    if (!cart.items.length) {
        throw new Error('Your cart is empty.')
    }

    const userId = Number(getUserId(req.session.user))
    const shippingAddress = req.session.pendingCheckout?.shippingAddress

    if (!shippingAddress) {
        throw new Error('Shipping information is missing.')
    }

    await Product.ensureStock(cart.items)
    await Product.decrementStock(cart.items)

    const priorOrders = await Order.countByUser(userId)
    const orderNumber = priorOrders + 1

    const order = await Order.create({
        userId,
        items: cart.items,
        subtotal: cart.totals.subtotal,
        tax: cart.totals.tax,
        total: cart.totals.total,
        shippingAddress,
        paymentMethod: 'nets',
        status: 'PAID'
    })

    clearCart(req.session)
    req.session.pendingCheckout = null
    req.session.netsOrderCompleted = {
        orderId: order.id,
        orderNumber
    }

    return { order, orderNumber }
}

class NetsController {
    static async generateQrCode(req, res) {
        const cart = getCart(req.session)
        calculateTotals(cart)

        if (!cart.items.length) {
            req.flash('error', 'Your cart is empty.')
            return res.redirect('/shop')
        }

        try {
            const courseInitId = await loadCourseInitId()
            const txnId = process.env.NETS_TXN_ID || DEFAULT_TXN_ID
            const amount = Number(cart.totals.total).toFixed(2)

            const requestBody = {
                txn_id: txnId,
                amt_in_dollars: amount,
                notify_mobile: 0
            }

            const response = await postWithRetry(
                NETS_QR_REQUEST_URL,
                requestBody,
                getNetsHeaders(),
                1
            )

            const qrData = response?.data?.result?.data || {}

            if (qrData.response_code === '00' && Number(qrData.txn_status) === 1 && qrData.qr_code) {
                const txnRetrievalRef = qrData.txn_retrieval_ref
                const txnNetsQrId = qrData.txn_nets_qr_id

                req.session.netsPayment = {
                    txnRetrievalRef,
                    txnId,
                    txnNetsQrId,
                    courseInitId
                }
                req.session.netsOrderCompleted = null

                return res.render('netsQr', {
                    total: amount,
                    title: 'Scan to Pay',
                    qrCodeUrl: `data:image/png;base64,${qrData.qr_code}`,
                    txnRetrievalRef,
                    courseInitId,
                    networkCode: qrData.network_status,
                    timer: 300,
                    webhookUrl: `https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets/webhook?txn_retrieval_ref=${txnRetrievalRef}&course_init_id=${courseInitId}`,
                    fullNetsResponse: response.data,
                    apiKey: process.env.API_KEY,
                    projectId: process.env.PROJECT_ID
                })
            }

            const errorMsg = qrData.error_message || 'An error occurred while generating the QR code.'
            return res.render('netsTxnFailStatus', {
                message: errorMsg
            })
        } catch (error) {
            console.error('Error in generateQrCode:', error.message)
            if (error?.response?.status === 504) {
                req.flash('error', 'NETS gateway timeout. Please try again.')
                return res.redirect('/checkout')
            }
            res.redirect('/nets-qr/fail')
        }
    }

    static async streamPaymentStatus(req, res) {
        const txnRetrievalRef = req.params.txnRetrievalRef
        const txnId = req.session.netsPayment?.txnId
        const txnNetsQrId = req.session.netsPayment?.txnNetsQrId

        if (!txnRetrievalRef) {
            res.status(400).json({ error: 'Missing transaction reference.' })
            return
        }

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders?.()

        let isClosed = false
        const startedAt = Date.now()

        const sendEvent = (payload) => {
            if (!isClosed) {
                res.write(`data: ${JSON.stringify(payload)}\n\n`)
            }
        }

        const pollStatus = async () => {
            try {
                const { status, statusData } = await queryNetsStatus({
                    txnRetrievalRef,
                    txnId,
                    txnNetsQrId
                })

                if (status === 'success') {
                    sendEvent({ success: true, raw: statusData })
                    res.end()
                    return true
                }

                if (status === 'fail') {
                    sendEvent({ fail: true, raw: statusData })
                    res.end()
                    return true
                }

                sendEvent({ pending: true, raw: statusData })
            } catch (error) {
                console.error('Error polling NETS status:', error.message)
            }

            if (Date.now() - startedAt >= SSE_TIMEOUT_MS) {
                sendEvent({ fail: true })
                res.end()
                return true
            }

            return false
        }

        const interval = setInterval(async () => {
            const done = await pollStatus()
            if (done) {
                clearInterval(interval)
            }
        }, SSE_POLL_INTERVAL_MS)

        req.on('close', () => {
            isClosed = true
            clearInterval(interval)
        })
    }

    static async getStatus(req, res) {
        const txnRetrievalRef = req.params.txnRetrievalRef
        const txnId = req.session.netsPayment?.txnId
        const txnNetsQrId = req.session.netsPayment?.txnNetsQrId

        if (!txnRetrievalRef) {
            return res.status(400).json({ error: 'Missing transaction reference.' })
        }

        try {
            const { status, statusData } = await queryNetsStatus({
                txnRetrievalRef,
                txnId,
                txnNetsQrId
            })

            res.json({ status, raw: statusData })
        } catch (error) {
            console.error('Error fetching NETS status via API:', error.message)
            res.status(500).json({ error: 'Unable to fetch NETS status.' })
        }
    }

    static async showSuccess(req, res) {
        try {
            if (!req.session.netsOrderCompleted) {
                await finalizeOrderFromSession(req)
            }

            const orderNumber = req.session.netsOrderCompleted?.orderNumber
            const message = orderNumber
                ? `Payment received. Order #${orderNumber} placed successfully!`
                : 'Payment received.'

            res.render('netsTxnSuccessStatus', { message })
        } catch (error) {
            console.error('Error finalizing NETS order:', error.message)
            req.flash('error', error.message || 'Unable to finalize your order.')
            res.redirect('/checkout')
        }
    }

    static showFail(req, res) {
        const message = 'Payment failed or timed out.'
        res.render('netsTxnFailStatus', { message })
    }
}

module.exports = NetsController
