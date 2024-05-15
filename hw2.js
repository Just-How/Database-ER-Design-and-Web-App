//Download nodejs(https://nodejs.org/en/download)
//Run following command to install libraries: npm install express pg
//Alter ./creds.json with your local psql credentials
//Start server using command: node hw2.js
//Open browser and go to http://localhost:3000/

const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

const creds = require('./creds.json');
const pool = new Pool(creds);

function getPlanDetails(providerName, planName) {
    switch (providerName) {
        case 'AT&T':
            return getATTPlanDetails(planName);
        case 'Verizon':
            return getVerizonPlanDetails(planName);
        case 'T-Mobile':
            return getTMobilePlanDetails(planName);
        case 'Boost Mobile':
            return getBoostMobilePlanDetails(planName);
        case 'Metro PCs':
            return getMetroPCsPlanDetails(planName);
        case 'Straight Talk':
            return getStraightTalkPlanDetails(planName);
        default:
            return null;
    }
}

function getATTPlanDetails(planName) {
    switch (planName) {
        case 'Unlimited Minutes PAY for Data':
            return { price: 39.00, dataLimit: 50, pricePerGB: 0.09 };
        case 'Unlimited Data PAY for Minutes':
            return { price: 45.00, callLimit: 450, pricePerMinute: 0.06 };
        case 'Pay for both':
            return { price: 30.00, callLimit: 450, dataLimit: 50, pricePerGB: 0.09, pricePerMinute: 0.06 };
        case 'Unlimited':
            return { price: 60.00 };
        default:
            return null;
    }
}

function getVerizonPlanDetails(planName) {
    switch (planName) {
        case 'Unlimited Minutes PAY for Data':
            return { price: 24.00, dataLimit: 30, pricePerGB: 0.15 };
        case 'Unlimited Data PAY for Minutes':
            return { price: 30.00, callLimit: 300, pricePerMinute: 0.10 };
        case 'Pay for both':
            return { price: 20.00, callLimit: 300, dataLimit: 30, pricePerGB: 0.15, pricePerMinute: 0.10 };
        case 'Unlimited':
            return { price: 40.00 };
        default:
            return null;
    }
}

function getTMobilePlanDetails(planName) {
    switch (planName) {
        case 'Unlimited':
            return { price: 50.00 };
        default:
            return null;
    }
}

function getBoostMobilePlanDetails(planName) {
    switch (planName) {
        case 'Unlimited Minutes PAY for Data':
            return { price: 21.00, dataLimit: 35, pricePerGB: 0.19 };
        case 'Unlimited Data PAY for Minutes':
            return { price: 26.25, callLimit: 200, pricePerMinute: 0.13 };
        case 'Pay for both':
            return { price: 17.50, callLimit: 200, dataLimit: 35, pricePerGB: 0.19, pricePerMinute: 0.13 };
        case 'Unlimited':
            return { price: 35.00 };
        default:
            return null;
    }
}

function getMetroPCsPlanDetails(planName) {
    switch (planName) {
        case 'Unlimited':
            return { price: 55.00 };
        default:
            return null;
    }
}

function getStraightTalkPlanDetails(planName) {
    switch (planName) {
        case 'Unlimited':
            return { price: 45.00 };
        default:
            return null;
    }
}

app.get('/', async (req, res) => {
    const customerId = req.query.customerId;
    let transactionsHtml = "";
    let totalPrice = 0;
    let customerName = "";

    if (customerId) {
        try {
            const result = await pool.query(`
                SELECT Transaction.*, CONCAT(Customer.FirstName, ' ', Customer.LastName) AS fullname, Customer.accounttype, Customer.paymentmethod, PhonePlan.PlanName AS plan_name, PhonePlan.Price AS plan_price, PhonePlan.Tax AS tax, PhoneProvider.ProviderName AS provider_name
                FROM Transaction 
                JOIN PhonePlan ON Transaction.PlanID = PhonePlan.PlanID 
                JOIN Customer ON Transaction.CustomerID = Customer.CustomerID
                JOIN PhoneProvider ON PhonePlan.ProviderID = PhoneProvider.ProviderID
                WHERE Transaction.CustomerID = $1
                ORDER BY Transaction.TransactionTime ASC
            `, [customerId]);

            if (result.rows.length > 0) {
                customerName = result.rows[0].fullname;
                const transactionsPromises = result.rows.map(async row => {
                    const planName = row.plan_name;
                    let callDetails = "";

                    if (planName === 'Unlimited') {
                        callDetails = "Unlimited";
                    } else {
                        const planDetails = getPlanDetails(row.provider_name, planName);

                        if (planDetails) {
                            // Fetch total minutes and data usage from CallRecord
                            const callRecords = await pool.query(`
                                SELECT Duration, DataUsage
                                FROM CallRecord
                                WHERE CustomerID = $1
                            `, [customerId]);

                            console.log('callRecords:', callRecords);

                            // Extract the total minutes and total data usage from the result
                            const totalMinutesArray = callRecords.rows.map(record => record.duration);
                            const totalDataUsageArray = callRecords.rows.map(record => record.datausage);

                            console.log('totalMinutesArray:', totalMinutesArray);
                            console.log('totalDataUsageArray:', totalDataUsageArray);

                            const totalMinutes = totalMinutesArray.reduce((total, duration) => total + duration, 0);
                            const totalDataUsage = totalDataUsageArray.reduce((total, datausage) => total + datausage, 0);

                            // Log the extracted values to check if they are correct
                            console.log('totalMinutes:', totalMinutes);
                            console.log('totalDataUsage:', totalDataUsage);

                            // Calculate total minutes price and total data price
                            const totalPricePerMinute = planDetails.pricePerMinute || 0;
                            const totalPricePerGB = planDetails.pricePerGB || 0;

                            const totalMinutesPrice = totalMinutes * totalPricePerMinute;
                            const totalDataPrice = totalDataUsage * totalPricePerGB;

                            totalPrice += row.plan_price + row.tax + totalMinutesPrice + totalDataPrice;

                            callDetails = `
                                - Total Minutes: ${totalMinutes} | Total Data Usage: ${totalDataUsage}GB
                                - Total Minutes Price: $${totalMinutesPrice.toFixed(2)}
                                - Total Data Price: $${totalDataPrice.toFixed(2)}
                                - Price = $${planDetails.price.toFixed(2)}
                                ${planDetails.dataLimit ? `Limit = ${planDetails.dataLimit}GBs` : ''}
                                ${planDetails.callLimit ? `Limit = ${planDetails.callLimit} Minutes` : ''}
                                ${planDetails.pricePerGB ? `Price per GB = $${planDetails.pricePerGB.toFixed(2)} ` : ''}
                                ${planDetails.pricePerMinute ? `Price per Minute = $${planDetails.pricePerMinute.toFixed(2)} ` : ''}
                            `;
                        }
                    }

                    return `<p>Payment Type: ${row.paymenttype} | Account Type: ${row.accounttype} | Payment Method: ${row.paymentmethod} | Provider: ${row.provider_name} | Payment Plan: ${row.plan_name} | Transaction Time: ${row.transactiontime} ${callDetails} | Plan Price: $${row.plan_price} | Tax: $${row.tax}</p>`;
                });

                // Wait for all promises to resolve
                const resolvedTransactions = await Promise.all(transactionsPromises);
                transactionsHtml = resolvedTransactions.join('');
            }
        } catch (err) {
            return res.status(500).send("Error: " + err.message);
        }
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Transactions</title>
        </head>
        <body>
            <form action="/createTables" method="POST"> 
                <button type="submit">Generate Tables</button> 
            </form>
             <form action="/" method="GET">
                <label for="customerId">Enter Customer ID:</label>
                <input type="number" name="customerId" id="customerId" required>
                <button type="submit">Get Transactions</button>
            </form>
            ${customerName ? `<h2>Customer Name = ${customerName}:</h2>` : '<h2>Enter a Customer ID (1-10) to view transactions.</h2>'}
            <div>
                <h3>Transactions:</h3>
                ${transactionsHtml}
                ${transactionsHtml ? `<p>Total Price: $${totalPrice.toFixed(2)}</p>` : ''}
            </div>
            <a href="/Customer">Click here for Customers</a><br>
            <a href="/PhoneProvider">Click here for Phone Providers</a><br>
            <a href="/PhonePlan">Click here for Phone Plans</a><br>
            <a href="/CallRecord">Click here for Call Records</a><br>
            <a href="/MakeTransaction">Click here to make a Transaction</a><br>
            <a href="/SearchTable">Click here to Show a Table</a><br>
            <a href="/">Back to Home</a>
        </body>
        </html>
    `);
});

app.get('/Customer', async (req, res) => {
    const CustomerID = req.query.customerId; 
    let customerName = "";

    try {
        if (CustomerID) {
            const result = await pool.query(`
                SELECT *, CONCAT(Customer.LastName, ', ', Customer.FirstName) AS fullname
                FROM Customer
                WHERE Customer.CustomerID = $1
                ORDER BY Customer.LastName ASC
            `, [CustomerID]);
            if (result.rows.length > 0) {
                customerName = result.rows[0].fullname; 
                customersHtml = result.rows.map(row => {
                    return `<p>Name: ${row.fullname} | Address: ${row.homeaddress} | Email: ${row.email} | Billing Address: ${row.billingaddress}</p>`;
                }).join('');
            } else {
                customersHtml = "No customers found with the provided ID.";
            }
        } else {
            const result = await pool.query(`
                SELECT *, CONCAT(Customer.LastName, ', ', Customer.FirstName) AS fullname
                FROM Customer
                ORDER BY Customer.LastName DESC
            `);
            if (result.rows.length > 0) {
                customersHtml = result.rows.map(row => {
                    return `<p>Full Name: ${row.fullname} | Address: ${row.homeaddress} | Email: ${row.email} | Billing Address: ${row.billingaddress}</p>`;
                }).join('');
            } else {
                customersHtml = "No customers found.";
            }
        }
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).send("Error: " + error.message);
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Customers</title>
        </head>
        <body>
            <h2>${customerName ? `Customer Name = ${customerName}` : 'Customers List'}</h2>
            ${customersHtml}
            <a href="/">Back to Home</a>
        </body>
        </html>
    `);
});

app.get('/PhonePlan', async (req, res) => {
    let phonePlansHtml = "";

    try {
        const result = await pool.query(`
            SELECT PhonePlan.*, PhoneProvider.providername
            FROM PhonePlan
            JOIN PhoneProvider ON PhonePlan.providerid = PhoneProvider.providerid
            ORDER BY PhonePlan.providerid
        `);
        
        if (result.rows.length > 0) {
            phonePlansHtml = result.rows.map(row => {
                return `<p>Provider: ${row.providername} | Plan Name: ${row.planname} | Call Limit: ${row.calllimit} Minutes | Data Limit: ${row.datalimit}GBs | Price: $${row.price} | Tax: $${row.tax}</p>`;
            }).join('');
        } else {
            phonePlansHtml = "No phone plans found.";
        }
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).send("Error: " + error.message);
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Phone Plans</title>
        </head>
        <body>
            <h2>Phone Plans List</h2>
            ${phonePlansHtml}
            <a href="/">Back to Home</a>
        </body>
        </html>
    `);
});

app.get('/CallRecord', async (req, res) => {
    const firstName = req.query.firstName;
    const lastName = req.query.lastName;
    let callRecordsHtml = "";

    try {
        const result = await pool.query(`
            SELECT CallRecord.Call_ID, CONCAT(Customer.LastName, ', ', Customer.FirstName) AS fullName, CallRecord.CallDate, CallRecord.Duration, CallRecord.DataUsage
            FROM CallRecord
            JOIN Customer ON CallRecord.CustomerID = Customer.CustomerID
            WHERE Customer.FirstName = $1 AND Customer.LastName = $2
            ORDER BY CallRecord.CallDate ASC
        `, [firstName, lastName]);

        if (result.rows.length > 0) {
            callRecordsHtml = result.rows.map(row => {
                return `<p>Customer: ${row.fullname} | Call Date: ${row.calldate} | Duration: ${row.duration} Minutes | Data Usage: ${row.datausage}GBs</p>`;
            }).join('');
        } else {
            callRecordsHtml = "No call records found for the provided customer.";
        }
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).send("Error: " + error.message);
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Call Records</title>
        </head>
        <body>
            <form action="/CallRecord" method="GET">
                <label for="firstName">Enter Customer's First Name:</label>
                <input type="text" name="firstName" id="firstName" required><br>
                <label for="lastName">Enter Customer's Last Name:</label>
                <input type="text" name="lastName" id="lastName" required><br>
                <button type="submit">Get Call Records</button>
            </form>
            <h2>Call Records</h2>
            ${callRecordsHtml}
            <a href="/">Back to Home</a>
        </body>
        </html>
    `);
});
app.get('/MakeTransaction', async (req, res) => {
    const customerId = req.query.customerId;
    const phoneNumber = "'" + req.query.PhoneNumber + "'";
    const autoManuel = req.query.AutoManuel;

    let transactionHtml = "";
    if (customerId && phoneNumber && autoManuel) {
        try {
            let transactionID = 0;
            var result = await pool.query(`SELECT MAX(TransactionID) AS max FROM Transaction;`);
            if (result.rows.length > 0) {
                transactionHtml = result.rows.map(row => {
                    transactionID = (row.max * 1) + 1;
                    //console.log(transactionID);
                }).join('');
            } else {
                transactionHtml = "Transaction failed1.";
            }
            
            let planID = 0;
            result = await pool.query(`SELECT (PlanID + 0) AS plan FROM PhoneNumber WHERE PhoneNumber = ${phoneNumber};`);
            if (result.rows.length > 0) {
                transactionHtml = result.rows.map(row => {
                    planID = row.plan * 1;
                    //console.log(planID);
                }).join('');
            } else {
                transactionHtml = "Transaction failed2.";
            }
            
            let money = 0;
            result = await pool.query(`SELECT (Price + Tax) AS total FROM PhonePlan WHERE PlanID = $1;`, [planID]);
            if (result.rows.length > 0) {
                transactionHtml = result.rows.map(row => {
                    money += row.total;
                    //console.log(money);
                }).join('');
            } else {
                transactionHtml = "Transaction failed3.";
            }
            
            let time = new Date();
            let transactionTime = "" + time.getFullYear() + "-" + time.getMonth() + "-" + time.getDate() + " " + time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds();
            
            await pool.query(`
                INSERT INTO Transaction (TransactionID, CustomerID, PlanID, TransactionTime, PaymentType, Amount) 
                VALUES ($1, $2, $3, $4, $5, $6);
            `, [transactionID, customerId, planID, transactionTime, autoManuel, money]);

            await pool.query(`
                UPDATE Bank
                SET money = money - $1
                WHERE CustomerId = $2;
            `, [money, customerId]);
        } catch (err) {
            return res.status(500).send("Error: " + err.message);
        }
    }
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Make Transaction</title>
        </head>
        <body>
            <form action="/MakeTransaction" method="GET">
                <label for="customerId">Enter Customer's ID:</label>
                <input type="text" name="customerId" id="customerId" required><br>
                <label for="PhoneNumber">Enter Customer's Phone Number:</label>
                <input type="text" name="PhoneNumber" id="PhoneNumber" required><br>
                <label for="AutoManuel">Enter Payment type (Auto / Manual):</label>
                <input type="text" name="AutoManuel" id="AutoManuel" required><br>
                <button type="submit">Make Transaction</button>
            </form>
            <h2>Transaction</h2>
            ${transactionHtml}
            <a href="/">Back to Home</a>
        </body>
        </html>
    `);
});

app.get('/PhoneProvider', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM PhoneProvider ORDER BY ProviderID;');
        if (result.rows.length > 0) {
            let tableHtml = '<table><tr><th>ID</th><th>Name</th></tr>';
            result.rows.forEach(provider => {
                tableHtml += `<tr><td>${provider.providerid}</td><td>${provider.providername}</td></tr>`;
            });
            tableHtml += '</table>';
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Phone Providers</title>
                </head>
                <body>
                    <h2>Phone Providers</h2>
                    ${tableHtml}
                    <a href="/">Back to Home</a>
                </body>
                </html>
            `);
        } else {
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>No Providers</title>
                </head>
                <body>
                    <h2>No phone providers found.</h2>
                    <a href="/">Back to Home</a>
                </body>
                </html>
            `);
        }
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error</title>
            </head>
            <body>
                <h2>Error retrieving phone providers: ${err.message}</h2>
                <a href="/">Back to Home</a>
            </body>
            </html>
        `);
    }
});



app.get('/SearchTable', async (req, res) => {
    const table_name = req.query.table_name;

    let tableHtml = "";
    if (table_name) {
        try {
            //console.log(table_name);
            var result = await pool.query(`SELECT * FROM ${table_name};`);
            if (result.rows.length > 0) {
                tableHtml = result.rows.map(row => {
                    let answer = "";
                    for (let prop in row) {
                        answer += ' ' + prop + ': ' + row[prop] + '; ';
                    } 
                    answer += '<br>';
                    return answer;
                }).join('');
            } else {
                tableHtml = "Table does NOT exist.";
            }
        } catch (err) {
            return res.status(500).send("Error: " + err.message);
        }
    }
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Search Table</title>
        </head>
        <body>
            <form action="/SearchTable" method="GET">
                <label for="table_name">Enter Table Name:</label>
                <input type="text" name="table_name" id="table_name" required><br>
                <button type="submit">Find Table</button>
            </form>
            <h2>Table ${table_name}</h2>
            ${tableHtml}
            <a href="/">Back to Home</a>
        </body>
        </html>
    `);
});

app.post('/createTables', async (req, res) => {
    try {
        await pool.query(`

DROP TABLE IF EXISTS CallRecord, Transaction, PhoneNumber, PhonePlan, PhoneProvider, Bank, Customer;
        
CREATE TABLE Customer (
    CustomerID INT PRIMARY KEY,
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    HomeAddress VARCHAR(100),
    Email VARCHAR(100),
    AccountType VARCHAR(20),
    BillingAddress VARCHAR(100),
    PaymentMethod VARCHAR(50)
);

CREATE TABLE Bank (
    AccountID INT PRIMARY KEY,
    CustomerID INT,
    Money FLOAT,
    FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID)
);

CREATE TABLE PhoneProvider (
    ProviderID INT PRIMARY KEY,
    ProviderName VARCHAR(50)
);

CREATE TABLE PhonePlan (
    PlanID INT PRIMARY KEY,
    ProviderID INT,
    PlanName VARCHAR(50),
    CallLimit INT,
    DataLimit FLOAT,
    Price FLOAT,
    Tax FLOAT,
    FOREIGN KEY (ProviderID) REFERENCES PhoneProvider(ProviderID)
);

CREATE TABLE PhoneNumber (
    PhoneNumberID INT PRIMARY KEY,
    PlanID INT,
    CustomerID INT,
    PhoneNumber VARCHAR(15),
    FOREIGN KEY (PlanID) REFERENCES PhonePlan(PlanID),
    FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID)
);

CREATE TABLE Transaction (
    TransactionID INT PRIMARY KEY,
    CustomerID INT,
    PlanID INT,
    TransactionTime VARCHAR(50),
    PaymentType VARCHAR(50),
    AMOUNT FLOAT,
    FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID),
    FOREIGN KEY (PlanID) REFERENCES PhonePlan(PlanID)
);

CREATE TABLE CallRecord (
    Call_ID INT PRIMARY KEY,
    CustomerID INT,
    PhoneNumberID INT,
    PlanID INT,
    TransactionID INT,
    CallDate VARCHAR(50),
    Duration FLOAT,
    DataUsage NUMERIC(10, 2),
    FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID),
    FOREIGN KEY (PhoneNumberID) REFERENCES PhoneNumber(PhoneNumberID),
    FOREIGN KEY (PlanID) REFERENCES PhonePlan(PlanID),
    FOREIGN KEY (TransactionID) REFERENCES Transaction(TransactionID)
);

INSERT INTO Customer (CustomerID, FirstName, LastName, HomeAddress, Email, AccountType, BillingAddress, PaymentMethod)
VALUES (1, 'John', 'Doe', '120 Main St', 'jdoe@gmail.com', 'Postpaid', '120 Main St', 'Credit Card'),
       (2, 'Alice', 'Johnson', '333 Elm St', 'alice.j@outlook.com', 'Postpaid', '781 Canary Rd', 'Check'),
       (3, 'Sarah', 'Smith', '468 Oak Dr', 'ssmith@hotmail.com', 'Postpaid', '468 Oak Dr', 'Apple Pay'),
       (4, 'Michael', 'Jordan', '101 Pine St', 'jordan@nike.com', 'Prepaid', '101 Pine St', 'PayPal'),
       (5, 'Sam', 'Howell', '204 Maple St', 'howell@commanders.com', 'Prepaid', '1600 Fedex Way', 'Apple Pay'),
       (6, 'Tyreek', 'Hill', '2111 Brown St', 'cheetah@dolphins.com', 'Prepaid', '347 Don Shula Drive', 'PayPal'),
       (7, 'Jessica', 'Lee', '401 Cedar Dr', 'jes.lee@acme.com', 'Postpaid', '401 Cedar Dr', 'Check'),
       (8, 'Brian', 'Miller', '2711 Birch Blvd', 'brian.miller@shopcousa.com', 'Postpaid', '2711 Birch Blvd', 'Google Pay'),
       (9, 'Tee', 'Higgins', '900 Spruce Lane', 'teehigs@bengals.com', 'Postpaid', '510 Paul Brown St', 'Credit Card'),
       (10, 'Tank', 'Dell', '865 Fairview Avenue', 'dell@houston.com', 'Postpaid', '1111 Fountain Park', 'Google Pay');

INSERT INTO Bank (AccountID, CustomerID, Money) 
VALUES (1, 3, 2000.32),
       (2, 2, 4000.72),
       (3, 4, 500.34),
       (4, 5, 17.00),
       (5, 1, 91.23),
       (6, 6, 1234.38),
       (7, 10, 238.32),
       (8, 9, 494),
       (9, 7, 1303.43),
       (10, 8, 9999.99);

INSERT INTO PhoneProvider (ProviderID, ProviderName)
VALUES (1, 'AT&T'),
       (2, 'Verizon'),
       (3, 'T-Mobile'),
       (4, 'Boost Mobile'),
       (5, 'Metro PCs'),
       (6, 'Straight Talk');

INSERT INTO PhonePlan (PlanID, ProviderID, PlanName, CallLimit, DataLimit, Price, Tax)
VALUES (1, 1, 'Unlimited Minutes PAY for Data', 0, 50.0, 39.00, 3.22),
       (2, 2, 'Unlimited Minutes PAY for Data', 0, 30.0, 24.00, 1.98),
       (3, 4, 'Unlimited Minutes PAY for Data', 0, 35.0, 21.00, 1.73),
       (4, 1, 'Unlimited Data PAY for Minutes', 450, 0, 45.00, 3.71),
       (5, 2, 'Unlimited Data PAY for Minutes', 300, 0, 30.00, 2.45),
       (6, 4, 'Unlimited Data PAY for Minutes', 200, 0, 26.25, 2.17),
       (7, 1, 'Pay for both', 450, 50.0, 30.00, 2.48),
       (8, 2, 'Pay for both', 300, 30.0, 20.00, 1.65),
       (9, 4, 'Pay for both', 200, 35.0, 17.50, 1.44),
       (10, 1, 'Unlimited', 0, 0, 60.00, 4.95),
       (11, 2, 'Unlimited', 0, 0, 40.00, 3.30),
       (12, 3, 'Unlimited', 0, 0, 50.00, 4.13),
       (13, 4, 'Unlimited', 0, 0, 35.00, 2.89),
       (14, 5, 'Unlimited', 0, 0, 55.00, 4.54),
       (15, 6, 'Unlimited', 0, 0, 45.00, 3.71);

INSERT INTO PhoneNumber (PhoneNumberID, PlanID, CustomerID, PhoneNumber)
VALUES (1, 2, 1, '123-456-7890'),
       (2, 4, 2, '987-654-3210'),
       (3, 5, 3, '222-552-9192'),
       (4, 10, 4, '800-806-6454'),
       (5, 11, 5, '301-276-6350'),
       (6, 12, 6, '305-943-8000'),
       (7, 7, 7, '675-844-7400'),
       (8, 7, 8, '995-565-4039'),
       (9, 7, 9, '513-621-8383'),
       (10, 1, 10, '832-667-2299'),
       (11, 10, 4, '212-832-9553'),
       (12, 11, 5, '855-217-9895'),
       (13, 12, 6, '305-943-6756'),
       (14, 7, 9, '513-621-3550');

INSERT INTO Transaction (TransactionID, CustomerID, PlanID, TransactionTime, PaymentType, Amount)
VALUES       -- November Transaction Log
       (1, 1, 2, '2022-11-30 10:30:00', 'Auto', NULL),
       (2, 2, 4, '2022-11-30 15:45:00', 'Manual', NULL),
       (3, 3, 5, '2022-11-30 11:20:00', 'Manual', NULL),
       (4, 4, 10, '2022-11-1 22:10:00', 'Auto', NULL),
       (5, 5, 11, '2022-11-1 5:55:00', 'Auto', NULL),
       (6, 6, 12, '2022-11-1 8:40:00', 'Auto', NULL),
       (7, 7, 1, '2022-11-30 17:25:00', 'Manual', NULL),
       (8, 8, 8, '2022-11-30 13:15:00', 'Manual', NULL),
       (9, 9, 7, '2022-11-30 14:35:00', 'Auto', NULL),
       (10, 10, 1, '2022-11-30 3:05:00', 'Auto', NULL),

             -- October Transaction Log
       (11, 1, 2, '2022-10-31 10:30:00', 'Auto', NULL),
       (12, 2, 4, '2022-10-31 9:45:00', 'Manual', NULL),
       (13, 3, 5, '2022-10-31 10:20:00', 'Manual', NULL),
       (14, 4, 10, '2022-10-1 22:10:00', 'Auto', NULL),
       (15, 5, 11, '2022-10-1 5:55:00', 'Auto', NULL),
       (16, 6, 12, '2022-10-1 8:40:00', 'Auto', NULL),
       (17, 7, 1, '2022-10-31 14:25:00', 'Manual', NULL),
       (18, 8, 8, '2022-10-31 13:05:00', 'Manual', NULL),
       (19, 9, 7, '2022-10-31 14:35:00', 'Auto', NULL),
       (20, 10, 1, '2022-10-31 3:05:00', 'Auto', NULL);

       INSERT INTO CallRecord (Call_ID, CustomerID, PhoneNumberID, PlanID, TransactionID, CallDate, Duration, DataUsage)
       VALUES      -- November Call Log
              (1, 1, 1, 2, 1, '2022-11-03 09:22:00', 11.00, 1.10),
              (2, 1, 1, 2, 1, '2022-11-07 09:55:00', 07.15, .715),
              (3, 1, 1, 2, 1, '2022-11-13 13:08:00', 13.45, 1.345),
              (4, 1, 1, 2, 1, '2022-11-19 15:40:00', 06.15, .615),
              (5, 1, 1, 2, 1, '2022-11-25 18:15:00', 04.00, .40),
              
              (6, 2, 2, 4, 2, '2022-11-02 07:12:00', 06.00, .60),
              (7, 2, 2, 4, 2, '2022-11-09 07:29:00', 02.15, .215),
              (8, 2, 2, 4, 2, '2022-11-18 12:59:00', 10.35, 1.035),
              (9, 2, 2, 4, 2, '2022-11-24 16:43:00', 13.30, 1.33),
              (10, 2, 2, 4, 2, '2022-11-28 20:33:00', 09.20, .92),
       
              (11, 3, 3, 5, 3, '2022-11-05 11:15:00', 15.00, 1.50),
              (12, 3, 3, 5, 3, '2022-11-09 06:38:00', 09.00, .90),
              (13, 3, 3, 5, 3, '2022-11-11 15:31:00', 03.45, .345),
              (14, 3, 3, 5, 3, '2022-11-15 09:45:00', 02.59, .259),
              (15, 3, 3, 5, 3, '2022-11-21 14:52:00', 22.15, 2.215),
       
              (16, 4, 4, 10, 4, '2022-11-02 09:46:00', 18.50, 1.85),
              (17, 4, 4, 10, 4, '2022-11-03 11:01:00', 20.10, 2.01),
              (18, 4, 4, 10, 4, '2022-11-10 11:44:00', 10.00, 1.00),
              (19, 4, 11, 10, 4, '2022-11-10 12:20:00', 08.25, .825),
              (20, 4, 11, 10, 4, '2022-11-12 14:50:00', 06.12, .612),
              (21, 4, 11, 10, 4, '2022-11-20 15:15:00', 09.18, .918),
              (22, 4, 11, 10, 4, '2022-11-25 16:26:00', 02.55, .255),
              (23, 4, 11, 10, 4, '2022-11-28 07:19:00', 05.41, .541),
       
              (24, 5, 5, 11, 5,'2022-11-02 04:04:00', 07.15, .715),
              (25, 5, 5, 11, 5,'2022-11-03 05:08:00', 08.59, .859),
              (26, 5, 5, 11, 5, '2022-11-04 12:10:00', 12.44, 1.244),
              (27, 5, 5, 11, 5, '2022-11-05 10:22:00', 11.00, 1.10),
              (28, 5, 5, 11, 5, '2022-11-08 12:18:00', 10.28, 1.028),
              (29, 5, 5, 11, 5, '2022-11-12 17:58:00', 03.26, .326),
              (30, 5, 12, 11, 5, '2022-11-16 07:21:00',06.15, .615),
              (31, 5, 12, 11, 5, '2022-11-22 11:30:00', 10.01, 1.001),
              (32, 5, 12, 11, 5, '2022-11-25 20:16:00', 10.35, 1.035),    
       
              (33, 6, 6, 12, 6, '2022-11-06 10:22:00', 09.25, .925),
              (34, 6, 6, 12, 6, '2022-11-09 11:44:00', 03.45, .345),
              (35, 6, 6, 12, 6, '2022-11-11 16:02:00', 10.19, 1.019),
              (36, 6, 6, 12, 6, '2022-11-15 09:15:00', 18.50, 1.850),
              (37, 6, 13, 12, 6, '2022-11-19 8:43:00', 19.11, 1.911),
              (38, 6, 13, 12, 6, '2022-11-20 13:54:00', 09.11, .911),
              (39, 6, 13, 12, 6, '2022-11-22 17:19:00', 22.15, 2.215),
              (40, 6, 13, 12, 6, '2022-11-23 07:29:00', 10.24, 1.024),
              (41, 6, 13, 12, 6, '2022-11-28 15:38:00', 09.00, .90),
       
              (42, 7, 7, 7, 7, '2022-11-09 05:09:00', 13.59, 1.359),
              (43, 7, 7, 7, 7, '2022-11-11 09:50:00', 11.38, 1.138),
              (44, 7, 7, 7, 7, '2022-11-17 08:15:00', 06.20, .620),
              (45, 7, 7, 7, 7, '2022-11-21 10:32:00', 05.30, .530),
              (46, 7, 7, 7, 7, '2022-11-28 11:56:00', 18.19, 1.819),
              (47, 7, 7, 7, 7, '2022-11-29 17:04:00', 19.31, 1.931),
       
              (48, 8, 8, 7, 8, '2022-11-04 09:07:00', 13.59, 1.359),
              (49, 8, 8, 7, 8, '2022-11-06 10:51:00', 05.07, .507),
              (50, 8, 8, 7, 8, '2022-11-09 11:28:00', 07.10, .71),
              (51, 8, 8, 7, 8, '2022-11-12 12:11:00', 00.49, .049),
              (52, 8, 8, 7, 8, '2022-11-15 16:56:00', 25.40, 2.54),
              (53, 8, 8, 7, 8, '2022-11-22 18:22:00', 18.19, 1.819),
       
              (54, 9, 9, 7, 9, '2022-11-02 16:30:00', 19.30, 1.930),
              (55, 9, 9, 7, 9, '2022-11-05 11:20:00', 15.56, 1.556),
              (56, 9, 9, 7, 9, '2022-11-06 15:11:00', 13.45, 1.345),
              (57, 9, 9, 7, 9, '2022-11-07 06:40:00', 12.00, 1.20),
              (58, 9, 9, 7, 9, '2022-11-12 09:56:00', 21.20, 2.12),
              (59, 9, 14, 7, 9, '2022-11-17 10:10:00', 6.22, .622),
              (60, 9, 14, 7, 9, '2022-11-20 11:01:00', 08.26, .826),
              (61, 9, 14, 7, 9, '2022-11-26 19:44:00', 05.29, .529),
       
              (62, 10, 10, 1, 10, '2022-11-06 09:49:00', 04.33, .433),
              (63, 10, 10, 1, 10, '2022-11-10 12:15:00', 22.51, 2.251),
              (64, 10, 10, 1, 10, '2022-11-15 13:24:00', 09.55, .955),
              (65, 10, 10, 1, 10, '2022-11-20 15:34:00', 13.33, 1.333),
              (66, 10, 10, 1, 10, '2022-11-21 08:23:00', 18.06, 1.806),
              (67, 10, 10, 1, 10, '2022-11-22 07:22:00', 07.00, .70),
              (68, 10, 10, 1, 10, '2022-11-25 10:07:00', 09.33, .933),
              (69, 10, 10, 1, 10, '2022-11-29 11:29:00', 22.04, 2.204),
       
                   -- October Call Log
              (70, 1, 1, 2, 11, '2022-10-04 09:22:00', 2.04, .204),
              (71, 1, 1, 2, 11, '2022-10-08 09:55:00', 07.15, .715),
              (72, 1, 1, 2, 11, '2022-10-12 13:08:00', 09.33, .933),
              (73, 1, 1, 2, 11, '2022-10-18 15:40:00', 18.06, 1.806),
              (74, 1, 1, 2, 11, '2022-10-24 18:15:00', 04.33, .433),
              
              (75, 2, 2, 4, 12, '2022-10-03 07:12:00', 05.29, .529),
              (76, 2, 2, 4, 12, '2022-10-08 07:29:00', 08.26, .826),
              (77, 2, 2, 4, 12, '2022-10-19 12:59:00', 10.35, 1.035),
              (78, 2, 2, 4, 12, '2022-10-25 16:43:00', 19.30, 1.93),
              (79, 2, 2, 4, 12, '2022-10-29 20:33:00', 09.20, .92),
       
              (80, 3, 3, 5, 13, '2022-10-04 11:15:00', 15.00, 1.50),
              (81, 3, 3, 5, 13, '2022-10-10 06:38:00', 09.00, .90),
              (82, 3, 3, 5, 13, '2022-10-12 15:31:00', 21.20, 2.12),
              (83, 3, 3, 5, 13, '2022-10-17 09:45:00', 13.33, 1.333),
              (84, 3, 3, 5, 13, '2022-10-22 14:52:00', 05.31, .531),
       
              (85, 4, 4, 10, 14, '2022-10-03 09:46:00', 18.50, 1.85),
              (86, 4, 4, 10, 14, '2022-10-05 11:01:00', 06.37, .637),
              (87, 4, 4, 10, 14, '2022-10-011 11:44:00', 10.10, 1.01),
              (88, 4, 11, 10, 14, '2022-10-11 12:20:00', 08.25, .825),
              (89, 4, 11, 10, 14, '2022-10-13 14:50:00', 06.12, .612),
              (90, 4, 11, 10, 14, '2022-10-21 15:15:00', 10.28, 1.028),
              (91, 4, 11, 10, 14, '2022-10-26 16:26:00', 01.50, .15),
              (92, 4, 11, 10, 14, '2022-10-29 07:19:00', 05.41, .541),
       
              (93, 5, 5, 11, 15,'2022-10-02 04:04:00', 06.37, .637),
              (94, 5, 5, 11, 15,'2022-10-03 05:08:00', 08.59, .859),
              (95, 5, 5, 11, 15, '2022-10-04 12:10:00', 12.44, 1.244),
              (96, 5, 5, 11, 15, '2022-10-05 10:22:00', 01.50, .15),
              (97, 5, 5, 11, 15, '2022-10-08 12:18:00', 10.28, 1.028),
              (98, 5, 5, 11, 15, '2022-10-12 17:58:00', 03.26, .326),
              (99, 5, 12, 11, 15, '2022-10-16 07:21:00', 07.22, .722),
              (100, 5, 12, 11, 15, '2022-10-22 11:30:00', 10.01, 1.001),
              (101, 5, 12, 11, 15, '2022-10-25 20:16:00', 15.15, 1.515),    
       
              (102, 6, 6, 12, 16, '2022-10-06 10:22:00', 11.05, 1.105),
              (103, 6, 6, 12, 16, '2022-10-09 11:44:00', 01.02, .102),
              (104, 6, 6, 12, 16, '2022-10-11 16:02:00', 10.19, 1.019),
              (105, 6, 6, 12, 16, '2022-10-15 09:15:00', 12.50, 1.25),
              (106, 6, 13, 12, 16, '2022-10-19 8:43:00', 19.11, 1.911),
              (107, 6, 13, 12, 16, '2022-10-20 13:54:00', 09.11, .911),
              (108, 6, 13, 12, 16, '2022-10-22 17:19:00', 24.10, 2.41),
              (109, 6, 13, 12, 16, '2022-10-23 07:29:00', 10.24, 1.024),
              (110, 6, 13, 12, 16, '2022-10-28 15:38:00', 06.09, .609),
       
              (111, 7, 7, 7, 17, '2022-10-09 05:09:00', 01.45, .145),
              (112, 7, 7, 7, 17, '2022-10-11 09:50:00', 11.38, 1.138),
              (113, 7, 7, 7, 17, '2022-10-17 08:15:00', 16.20, 1.620),
              (114, 7, 7, 7, 17, '2022-10-21 10:32:00', 15.30, 1.530),
              (115, 7, 7, 7, 17, '2022-10-28 11:56:00', 07.19, .719),
              (116, 7, 7, 7, 17, '2022-10-29 17:04:00', 05.31, .531),
       
              (117, 8, 8, 7, 18, '2022-10-04 09:07:00', 03.59, .359),
              (118, 8, 8, 7, 18, '2022-10-06 10:51:00', 15.07, 1.507),
              (119, 8, 8, 7, 18, '2022-10-09 11:28:00', 17.10, 1.710),
              (120, 8, 8, 7, 18, '2022-10-12 12:11:00', 02.49, .249),
              (121, 8, 8, 7, 18, '2022-10-15 16:56:00', 05.40, .54),
              (122, 8, 8, 7, 18, '2022-10-22 18:22:00', 22.19, 2.219),
       
              (123, 9, 9, 7, 19, '2022-10-02 16:30:00', 09.30, .93),
              (124, 9, 9, 7, 19, '2022-10-05 11:20:00', 15.56, 1.556),
              (125, 9, 9, 7, 19, '2022-10-06 15:11:00', 03.45, .345),
              (126, 9, 9, 7, 19, '2022-10-07 06:40:00', 02.00, .20),
              (127, 9, 9, 7, 19, '2022-10-12 09:56:00', 11.20, 1.120),
              (128, 9, 14, 7, 19, '2022-10-17 10:10:00', 16.22, 1.622),
              (129, 9, 14, 7, 19, '2022-10-20 11:01:00', 18.26, 1.826),
              (130, 9, 14, 7, 19, '2022-10-26 19:44:00', 15.29, 1.529),
       
              (131, 10, 10, 1, 20, '2022-10-06 09:49:00', 14.33, 1.433),
              (132, 10, 10, 1, 20, '2022-10-10 12:15:00', 02.51, .251),
              (133, 10, 10, 1, 20, '2022-10-15 13:24:00', 07.22, .722),
              (134, 10, 10, 1, 20, '2022-10-20 15:34:00', 13.33, 1.333),
              (135, 10, 10, 1, 20, '2022-10-21 08:23:00', 21.20, 2.120),
              (136, 10, 10, 1, 20, '2022-10-22 07:22:00', 07.15, .715),
              (137, 10, 10, 1, 20, '2022-10-25 10:07:00', 05.29, .529),
              (138, 10, 10, 1, 20, '2022-10-29 11:29:00', 22.04, 2.204);
        `);

        res.status(200).send(`
            Tables created successfully.
            <br><br>
            <a href="/">Back to Home</a>
        `);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error creating tables: ' + error.message);
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});