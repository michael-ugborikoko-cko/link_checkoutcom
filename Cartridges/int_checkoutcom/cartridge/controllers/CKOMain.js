'use strict';

// API Includes
var Site = require('dw/system/Site');
var siteControllerName = Site.getCurrent().getCustomPreferenceValue('ckoSgStorefrontControllers');
var app = require(siteControllerName + '/cartridge/scripts/app');
var guard = require(siteControllerName + '/cartridge/scripts/guard');
var ISML = require('dw/template/ISML');
var OrderMgr = require('dw/order/OrderMgr');
var BasketMgr = require('dw/order/BasketMgr');

// Checkout.com Event functions
var eventsHelper = require('~/cartridge/scripts/helpers/eventsHelper');

// Utility
var ckoHelper = require('~/cartridge/scripts/helpers/ckoHelper');

// Apm Filter Configuration file
var ckoApmFilterConfig = require('~/cartridge/scripts/config/ckoApmFilterConfig');

// Card Mada Bins
var ckoMadaConfig = require('~/cartridge/scripts/config/ckoMadaConfig');

/**
 * Handles a failed payment from the Checkout.com payment gateway
 */
function handleFail() {
    // Load the order
    // eslint-disable-next-line
    var order = OrderMgr.getOrder(session.privacy.ckoOrderId);

    // Restore the cart
    OrderMgr.failOrder(order, true);

    // Send back to the error page
    ISML.renderTemplate('custom/common/response/failed.isml');
}

/**
 * Handles responses from the Checkout.com payment gateway
 */
function handleReturn() {
    // Prepare some variables
    var gResponse = false;
    var mode = ckoHelper.getValue('ckoMode');
    var serviceName = 'cko.verify.charges.' + mode + '.service';
    var orderId = ckoHelper.getOrderId();
    var gVerify;

    // If there is a track id
    if (orderId) {
        // Load the order
        var order = OrderMgr.getOrder(orderId);
        if (order) {
            // Check the payment token if exists
            // eslint-disable-next-line
            var sessionId = request.httpParameterMap.get('cko-session-id').stringValue;

            // If there is a payment session id available, verify
            if (sessionId) {
                // Perform the request to the payment gateway
                gVerify = ckoHelper.gatewayClientRequest(
                    serviceName,
                    { paymentToken: sessionId }
                );

                // Log the payment verify data
                ckoHelper.log(
                    serviceName + ' - ' + ckoHelper._('cko.verify.data', 'cko'),
                    gVerify
                );

                // If there is a valid response
                if (typeof (gVerify) === 'object' && Object.prototype.hasOwnProperty.call(gVerify, 'id')) {
                    // Log the payment response data
                    ckoHelper.log(
                        serviceName + ' - ' + ckoHelper._('cko.response.data', 'cko'),
                        gVerify
                    );

                    // Test the response
                    if (ckoHelper.paymentSuccess(gVerify)) {
                        // Show order confirmation page
                        app.getController('COSummary').ShowConfirmation(order);
                    } else {
                        // Restore the cart
                        OrderMgr.failOrder(order, true);

                        // Send back to the error page
                        ISML.renderTemplate('custom/common/response/failed.isml');
                    }
                } else {
                    // Restore the cart
                    OrderMgr.failOrder(order, true);

                    // Send back to the error page
                    ISML.renderTemplate('custom/common/response/failed.isml');
                }
            } else {
                // Get the response
                // eslint-disable-next-line
                gResponse = JSON.parse(request.httpParameterMap.getRequestBodyAsString());

                // Log the payment response data
                ckoHelper.log(
                    serviceName + ' - ' + ckoHelper._('cko.response.data', 'cko'),
                    gResponse
                );

                // Process the response data
                if (ckoHelper.paymentIsValid(gResponse)) {
                    app.getController('COSummary').ShowConfirmation(order);
                } else {
                    handleFail(gResponse);
                }
            }
        } else {
            handleFail(null);
        }
    } else {
        handleFail(null);
    }
}

/**
 * Handles webhook responses from the Checkout.com payment gateway
 * @returns {string} The response string
 */
function handleWebhook() {
    var isValidResponse = ckoHelper.isValidResponse();
    if (isValidResponse) {
        // Get the response as JSON object
        // eslint-disable-next-line
        var hook = JSON.parse(request.httpParameterMap.getRequestBodyAsString());

        // Check the webhook event
        if (hook !== null && Object.prototype.hasOwnProperty.call(hook, 'type')) {
            // Get a camel case function name from event type
            var func = '';
            var parts = hook.type.split('_');
            for (var i = 0; i < parts.length; i++) {
                func += (i === 0) ? parts[i] : parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
            }
            if (Object.prototype.hasOwnProperty.call(eventsHelper, func)) {
                // Call the event
                eventsHelper[func](hook);
            }
        } else {
            // Write the response
            return ckoHelper.ckoResponse(null);
        }
    }

    // Write the response
    return ckoHelper.ckoResponse(null);
}

/**
 * Initializes the credit card list by determining the saved customer payment method
 */
function getCardsList() {
    var applicablePaymentCards;
    var data = [];

    // If user logged in
    // eslint-disable-next-line
    if (customer.authenticated) {
        var profile = customer.getProfile(); // eslint-disable-line
        if (profile) {
            applicablePaymentCards = customer.profile.getWallet().getPaymentInstruments(); // eslint-disable-line
            for (var i = 0; i < applicablePaymentCards.length; i++) {
                data.push({
                    cardId: applicablePaymentCards[i].getUUID(),
                    cardNumber: applicablePaymentCards[i].getCreditCardNumber(),
                    cardHolder: applicablePaymentCards[i].creditCardHolder,
                    cardType: applicablePaymentCards[i].getCreditCardType(),
                    expiryMonth: applicablePaymentCards[i].creditCardExpirationMonth,
                    expiryYear: applicablePaymentCards[i].creditCardExpirationYear,
                });
            }
        }

        // Send the output for rendering
        ISML.renderTemplate('custom/ajax/output.isml', { data: JSON.stringify(data) });
    } else {
        app.getModel('Customer').logout();
        app.getView().render('csrf/csrffailed');
    }
}

/**
 * Apms filter helper.
 * @returns {Object} The response object
 */
function getApmFilter() {
    try {
        // Prepare some variables
        var basket = BasketMgr.getCurrentBasket();
        var currencyCode = basket.getCurrencyCode();
        var countryCode = basket.defaultShipment.shippingAddress.countryCode.valueOf();

        // Prepare the filter object
        var filterObject = {
            country: countryCode,
            currency: currencyCode,
        };

        // Prepare the response object
        var responseObject = {
            filterObject: filterObject,
            ckoApmFilterConfig: ckoApmFilterConfig,
        };

        // Write the response
        return ckoHelper.ckoResponse(responseObject);
    } catch (e) {
        // Write the response
        return ckoHelper.ckoResponse(null);
    }
}

/**
 * Mada Bins helper.
 * @returns {Object} The response object
 */
function getMadaBin() {
    try {
        var madaBins = ckoMadaConfig;

        // Write the response
        return ckoHelper.ckoResponse(madaBins);
    } catch (e) {
        // Write the response
        return ckoHelper.ckoResponse(null);
    }
}

// Module exports
exports.HandleReturn = guard.ensure(['get', 'https'], handleReturn);
exports.HandleFail = guard.ensure(['get', 'https'], handleFail);
exports.HandleWebhook = guard.ensure(['post', 'https'], handleWebhook);
exports.GetCardsList = guard.ensure(['post', 'https'], getCardsList);
exports.GetApmFilter = guard.ensure(['get', 'https'], getApmFilter);
exports.GetMadaBin = guard.ensure(['get', 'https'], getMadaBin);
