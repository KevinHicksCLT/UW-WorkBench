// ── Specialty, reinsurance and London-market form chassis (SCRUM-229) ──
// Specimen-grade synthetic wording only — fictional, not filed carrier text.
import type { FormChassis } from './chassisTypes.js';

export const SPECIALTY_CHASSIS: Record<string, FormChassis> = {
  MARINE_CARGO: {
    key: 'MARINE_CARGO',
    documentKind: 'coverage-form',
    definitions: [
      {
        term: 'Cargo',
        text: 'Cargo means lawful goods and merchandise of the Insured, or of others for which the Insured has agreed to provide insurance, consisting of the property described in the Declarations, while at risk under this policy.',
      },
      {
        term: 'Transit',
        text: 'Transit means the period beginning when Cargo leaves the warehouse or place of storage named in the Declarations for the commencement of the voyage, continuing during the ordinary course of carriage, and ending on delivery to the final warehouse or place of storage at the destination named in the shipping documents.',
      },
      {
        term: 'Average',
        text: 'Average means partial loss of or damage to Cargo; General Average means a sacrifice or expenditure intentionally and reasonably made for the common safety of the venture, adjusted according to the law and practice governing the contract of carriage.',
      },
      {
        term: 'Conveyance',
        text: 'Conveyance means the vessel, aircraft, railcar, truck or other means of transport on which Cargo is carried, including connecting craft.',
      },
      {
        term: 'Valuation',
        text: 'Valuation means the amount of insurance on Cargo, computed as invoice cost plus freight plus ten percent unless a different basis is stated in the Declarations.',
      },
    ],
    insuringAgreements: [
      {
        name: 'All Risks Of Physical Loss',
        text: 'We insure Cargo against all risks of direct physical loss or damage from any external cause during Transit, except as excluded in this policy, from warehouse to warehouse within the geographic limits stated in the Declarations.',
      },
      {
        name: 'General Average And Salvage',
        text: 'We will pay the Insured’s contribution to General Average and salvage charges, adjusted or determined according to the contract of carriage or the governing law and practice, when incurred to avoid or in connection with the avoidance of a peril insured against.',
      },
      {
        name: 'Warehouse Coverage',
        text: 'We insure Cargo while at a warehouse or consolidation point named in the Declarations, up to the location limit shown, for a period not exceeding sixty days at any one location unless extended by endorsement.',
      },
      {
        name: 'Sue And Labor',
        text: 'In case of actual or imminent loss, the Insured must take all reasonable measures to avert or minimize the loss, and we will pay the reasonable charges so incurred in addition to the loss otherwise recoverable, in proportion to the interest insured.',
      },
    ],
    limitsNote:
      'The limit of liability shown in the Declarations for any one Conveyance is the most we will pay for all Cargo aboard that Conveyance in any one loss, and the separate location limit applies to Cargo at any one warehouse or terminal. The deductible shown in the Declarations applies to each loss, but does not apply to General Average, salvage charges or sue and labor expenses, and recovery will in no case exceed the insured Valuation of the Cargo lost or damaged.',
    exclusions: [
      {
        name: 'Inherent Vice And Ordinary Loss',
        text: 'We do not insure loss caused by inherent vice or nature of the Cargo, ordinary leakage, ordinary loss in weight or volume, or ordinary wear and tear.',
      },
      {
        name: 'Insufficient Packing',
        text: 'We do not insure loss caused by insufficiency or unsuitability of packing or preparation of the Cargo, where the packing was performed by the Insured or its employees or completed before the attachment of this insurance.',
      },
      {
        name: 'Delay',
        text: 'We do not insure loss, damage or expense proximately caused by delay, even if the delay is caused by a peril insured against.',
      },
      {
        name: 'Unseaworthiness With Privity',
        text: 'We do not insure loss arising from unseaworthiness or unfitness of the Conveyance where the Insured or its servants were privy to the unseaworthiness or unfitness at the time the Cargo was loaded.',
      },
      {
        name: 'War Strikes And Related Perils',
        text: 'We do not insure loss caused by war, civil war, capture, seizure, arrest or detainment, derelict mines or torpedoes, or by strikers, locked-out workmen, or persons acting from a political, terrorist or ideological motive, unless such coverage is added by endorsement.',
      },
      {
        name: 'Temperature Variation',
        text: 'We do not insure loss to perishable Cargo caused by variation in temperature unless directly resulting from the breakdown of refrigeration machinery for a period of not less than twenty-four consecutive hours, or from fire, collision, overturn or other accident to the Conveyance.',
      },
    ],
    conditions: [
      {
        name: 'Duties In The Event Of Loss',
        text: 'The Insured must give us prompt notice of loss, file a written claim against the carrier, bailee or other party responsible, note any exception on the delivery receipt before accepting delivery of damaged Cargo, and preserve all packing and shipping documents for our inspection.',
      },
      {
        name: 'Declarations And Premium',
        text: 'The Insured must declare to us all shipments coming within the terms of this policy as provided in the Declarations, and premium will be computed at the rates provided on the values declared; unintentional failure to declare a shipment will not void coverage, provided the omission is reported promptly upon discovery and premium is paid.',
      },
      {
        name: 'Subrogation And Impairment Of Recovery',
        text: 'Upon payment of a loss we are subrogated to all rights of recovery of the Insured against carriers, bailees and other parties, and any act of the Insured before or after loss that impairs those rights may invalidate coverage to the extent of the impairment.',
      },
      {
        name: 'Constructive Total Loss',
        text: 'A constructive total loss exists only when the Cargo is reasonably abandoned because its actual total loss appears unavoidable, or because the cost of recovering, reconditioning and forwarding it to destination would exceed its value on arrival.',
      },
      {
        name: 'Both To Blame Collision',
        text: 'Where the contract of carriage contains a both-to-blame collision clause, we will indemnify the Insured for any amount properly payable under that clause in respect of an insured loss, and the Insured must notify us when the carrier makes a claim under the clause.',
      },
    ],
    endorsements: [
      {
        suffixNo: '1310',
        title: 'War Risks And Strikes Coverage',
        body: 'A. War Risks. Notwithstanding the War Strikes And Related Perils exclusion, we insure loss of or damage to Cargo caused by war, civil war, revolution, capture or seizure, and by derelict mines or torpedoes, but only while the Cargo is waterborne on an overseas vessel or airborne on an overseas aircraft.\nB. Strikes Risks. We insure loss of or damage to Cargo caused by strikers, locked-out workmen, persons taking part in labour disturbances or civil commotions, and persons acting from a terrorist or political motive.\nC. Termination. Coverage under this endorsement may be cancelled by either party on seven days written notice, or forty-eight hours notice with respect to strikes risks on shipments to or from the countries named in the Schedule.',
      },
      {
        suffixNo: '1425',
        title: 'Exhibition And Consignment Extension',
        body: 'A. Extension. Coverage is extended to Cargo while at any exhibition, trade show or consignee premises named in the Schedule, and in Transit to and from such locations, up to the limit shown in the Schedule for any one location.\nB. Period. Coverage at any one exhibition or consignment location applies for a period not exceeding thirty days unless a longer period is stated in the Schedule.',
      },
    ],
    decItems: [
      'Named Insured And Address',
      'Policy Period',
      'Description Of Insured Cargo',
      'Geographic Limits Of Coverage',
      'Limit Any One Conveyance',
      'Limit Any One Location',
      'Valuation Basis And Deductible Each Loss',
      'Deposit Premium And Rate Schedule',
    ],
  },
  CRIME_FIDELITY: {
    key: 'CRIME_FIDELITY',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Employee',
        text: 'Employee means a natural person in the regular service of the Insured whom the Insured compensates and has the right to direct in the performance of that service, including a temporary or leased worker while performing duties for the Insured, but not an agent, broker or independent contractor.',
      },
      {
        term: 'Theft',
        text: 'Theft means the unlawful taking of Money, Securities or Other Property to the deprivation of the Insured.',
      },
      {
        term: 'Money',
        text: 'Money means currency, coins and bank notes in current use and having a face value, and traveler’s checks and money orders held for sale to the public.',
      },
      {
        term: 'Securities',
        text: 'Securities means negotiable and non-negotiable instruments or contracts representing either Money or property, including tokens, tickets and stamps in current use, but not Money.',
      },
      {
        term: 'Discovery',
        text: 'Discovery occurs when the Insured’s risk manager or any officer first becomes aware of facts that would cause a reasonable person to assume that a loss of a type covered by this policy has been or will be incurred, regardless of when the act causing the loss took place.',
      },
      {
        term: 'Fraudulent Instruction',
        text: 'Fraudulent Instruction means an electronic, telephonic or written instruction directing the transfer of funds or property, which instruction purports to have been issued by an authorized person but was in fact issued without that person’s knowledge or consent.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Employee Theft',
        text: 'We will pay for loss of or damage to Money, Securities and Other Property resulting directly from Theft committed by an Employee, whether identified or not, acting alone or in collusion with other persons.',
      },
      {
        name: 'Forgery Or Alteration',
        text: 'We will pay for loss resulting directly from Forgery or alteration of checks, drafts, promissory notes or similar written promises, orders or directions to pay a sum certain in Money, made or drawn by or drawn upon the Insured or purporting to have been so made or drawn.',
      },
      {
        name: 'On Premises And In Transit',
        text: 'We will pay for loss of Money and Securities resulting directly from Theft, disappearance or destruction while inside the premises or a banking premises, and while in Transit outside the premises in the care and custody of a messenger or an armored motor vehicle company.',
      },
      {
        name: 'Computer And Funds Transfer Fraud',
        text: 'We will pay for loss resulting directly from the fraudulent entry or change of electronic data or computer programs within a computer system, and for loss resulting directly from a Fraudulent Instruction directing a financial institution to transfer, pay or deliver funds from the Insured’s transfer account.',
      },
    ],
    limitsNote:
      'The Limit of Insurance shown in the Declarations for each insuring agreement is the most we will pay for all loss resulting directly from an occurrence, which means all loss caused by, or involving, one or more Employees or third parties, whether the result of a single act or a series of related acts. The deductible shown in the Declarations applies to each occurrence, and regardless of the number of years this policy remains in force or the number of premiums paid, no Limit of Insurance cumulates from year to year or period to period.',
    exclusions: [
      {
        name: 'Acts Of The Insured And Partners',
        text: 'This policy does not cover loss resulting from Theft or any other dishonest act committed by the Insured, any of the Insured’s partners or members, or any natural person owning more than ten percent of the Insured, whether acting alone or in collusion with others.',
      },
      {
        name: 'Prior Dishonesty Termination',
        text: 'This policy does not cover loss caused by an Employee after Discovery by the Insured of a dishonest act committed by that Employee, whether before or during the term of employment, involving Money, Securities or Other Property valued at more than five thousand dollars.',
      },
      {
        name: 'Inventory Shortage',
        text: 'This policy does not cover loss, or that part of any loss, the proof of which as to its existence or amount is dependent upon an inventory computation or a profit and loss computation; however, where the Insured establishes wholly apart from such computations that it has sustained a covered loss, such computations may be used to support the amount of loss claimed.',
      },
      {
        name: 'Trading Loss',
        text: 'This policy does not cover loss resulting from trading in Securities, commodities, futures or other financial instruments, whether in the Insured’s name or in a genuine or fictitious account, except to the extent of direct financial benefit received by the Employee committing the act.',
      },
      {
        name: 'Indirect Loss',
        text: 'This policy does not cover indirect or consequential loss of any nature, including loss of income not realized as the result of a covered loss, or costs incurred to establish the existence or amount of loss except as expressly provided.',
      },
      {
        name: 'Data Confidentiality Breach',
        text: 'This policy does not cover loss resulting from the disclosure or use of another person’s or organization’s confidential or personal information, including any liability or notification cost arising from such disclosure.',
      },
    ],
    conditions: [
      {
        name: 'Discovery Basis And Notice',
        text: 'This policy covers loss Discovered during the policy period, including loss sustained before the policy period as provided in the loss-sustained provisions, and the Insured must give us notice as soon as practicable after Discovery, and in no event later than sixty days thereafter, followed by a proof of loss with full particulars within one hundred twenty days.',
      },
      {
        name: 'Loss Sustained Under Prior Insurance',
        text: 'If loss is Discovered during this policy period but sustained under prior insurance that this policy replaced without interruption, we will pay the lesser of the amount recoverable under this policy or the amount that would have been recoverable under the prior insurance, and in no event more than the larger of the two limits.',
      },
      {
        name: 'Valuation And Settlement',
        text: 'Money is valued at its face value, Securities at their value at the close of business on the day the loss was Discovered, and Other Property at replacement cost; we may, at our option, pay the value of lost Securities or provide a lost-instrument bond.',
      },
      {
        name: 'Cooperation And Records',
        text: 'The Insured must cooperate with us in all matters pertaining to the loss, keep records of all Covered Property so we can verify the amount of any loss, and make Employees and records available for examination and interview as often as we reasonably require.',
      },
      {
        name: 'Recoveries',
        text: 'Recoveries, less the cost of obtaining them, will be applied first to reimburse the Insured for any loss in excess of the Limit of Insurance, then to us to the extent of our payment, and lastly to the Insured in satisfaction of the deductible.',
      },
    ],
    endorsements: [
      {
        suffixNo: '2160',
        title: 'Social Engineering Fraud Coverage',
        body: 'A. Coverage. We will pay for the loss of funds resulting directly from an Employee, in good faith, transferring funds in reliance upon an instruction from a person purporting to be a vendor, client, executive or Employee, where the instruction was in fact fraudulent, and the loss is Discovered during the policy period.\nB. Verification. Coverage applies only if the Insured’s written payment procedures required verification of any new or changed payment instruction through a channel other than the one on which the instruction was received, and those procedures were followed.\nC. Sublimit. The most we will pay under this endorsement for all loss arising from one occurrence is the sublimit shown in the Schedule, which is part of and not in addition to the Employee Theft Limit of Insurance.',
      },
      {
        suffixNo: '2290',
        title: 'ERISA Fidelity Extension For Benefit Plans',
        body: 'A. Extension. The employee benefit plans named in the Schedule are included as Insureds, and Employee includes any natural person who is a trustee, officer or administrator of a named plan, with respect to loss of plan assets caused by fraud or dishonesty.\nB. Priority Of Payment. If a covered loss involves both plan and non-plan property, payment will first be applied to the loss of the plan, and the deductible does not apply to loss sustained by a named plan.',
      },
    ],
    decItems: [
      'Named Insured And Address',
      'Policy Period',
      'Insuring Agreements Purchased And Limits',
      'Deductible Each Occurrence',
      'Premises Locations',
      'Named Benefit Plans',
      'Total Policy Premium',
    ],
  },
  SURETY_BOND: {
    key: 'SURETY_BOND',
    documentKind: 'coverage-form',
    definitions: [
      {
        term: 'Principal',
        text: 'Principal means the person or organization named in the bond form whose performance of an underlying obligation is guaranteed by the Surety.',
      },
      {
        term: 'Obligee',
        text: 'Obligee means the person, organization or public body named in the bond form to whom the Principal owes the bonded obligation and for whose benefit the bond is issued.',
      },
      {
        term: 'Surety',
        text: 'Surety means the company executing the bond, which guarantees to the Obligee the performance of the bonded obligation by the Principal.',
      },
      {
        term: 'Penal Sum',
        text: 'Penal Sum means the amount stated in the bond form, which is the maximum aggregate liability of the Surety under the bond regardless of the number of claims, claimants or years the bond remains in force.',
      },
      {
        term: 'Bonded Contract',
        text: 'Bonded Contract means the written contract between the Principal and the Obligee identified in the bond form, including the plans, specifications and conditions incorporated in it by reference.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Performance Guarantee',
        text: 'The Principal and the Surety bind themselves, jointly and severally, to the Obligee for the performance of the Bonded Contract, and if the Principal performs the Bonded Contract, this obligation shall be null and void; otherwise it shall remain in full force and effect up to the Penal Sum.',
      },
      {
        name: 'Payment Guarantee',
        text: 'The Principal and the Surety bind themselves, jointly and severally, to the Obligee to pay for labor, materials and equipment furnished for use in the performance of the Bonded Contract, for the benefit of claimants who have a direct contract with the Principal or with a subcontractor of the Principal.',
      },
      {
        name: 'Surety Performance Options',
        text: 'After an Obligee declaration of Principal default and termination of the Principal’s right to complete the Bonded Contract, the Surety may, at its option, arrange for the Principal to complete with the Obligee’s consent, complete the contract itself through agents or independent contractors, obtain new contractors to complete, or pay the Obligee the amount for which the Surety is liable.',
      },
    ],
    limitsNote:
      'The aggregate liability of the Surety under the bond is limited to the Penal Sum stated in the bond form, which is not cumulative from year to year or term to term, and no claim, suit or recovery of any kind shall increase the Surety’s liability beyond the Penal Sum. Where the bond secures a public obligation subject to statute, the terms of the applicable statute are incorporated and control over any conflicting provision of the bond form.',
    exclusions: [
      {
        name: 'Obligations Outside The Bonded Contract',
        text: 'The Surety is not liable for any obligation of the Principal other than the obligation identified in the bond form, including any modification that materially increases the bonded obligation without the Surety’s written consent, except that consent is not required for changes aggregating less than ten percent of the contract price.',
      },
      {
        name: 'Design And Efficacy Guarantees',
        text: 'The bond does not guarantee the efficacy, fitness or quality of any design, professional service or process specified by the Obligee, and the Surety is not liable for defects resulting from compliance with the Obligee’s plans and specifications.',
      },
      {
        name: 'Consequential Damages',
        text: 'The Surety is not liable for liquidated, delay or consequential damages except to the extent expressly assumed in the Bonded Contract and within the Penal Sum.',
      },
      {
        name: 'Fraud Of The Obligee',
        text: 'The bond is void as to any Obligee that obtains its issuance or any payment under it through fraud or material misrepresentation to the Surety.',
      },
      {
        name: 'Time-Barred Claims',
        text: 'The Surety is not liable for any claim, suit or action commenced after the expiration of two years from the date on which the Principal ceased work on the Bonded Contract, or such longer period as a mandatory statute of the jurisdiction requires.',
      },
    ],
    conditions: [
      {
        name: 'Notice Of Default',
        text: 'As a condition precedent to the Surety’s obligation, the Obligee must notify the Surety in writing that it is considering declaring a Principal default, meet with the Surety and the Principal on request within fifteen days, and, if default is declared, formally terminate the Principal’s right to complete and agree to pay the balance of the contract price in accordance with the Bonded Contract.',
      },
      {
        name: 'Claims Procedure',
        text: 'A claimant under a payment guarantee must give written notice of its claim, stating with substantial accuracy the amount claimed and the party to whom the labor or materials were furnished, within ninety days after the claimant last performed labor or furnished materials, and the Surety will answer the claim, stating the amounts that are undisputed and the basis for challenging any disputed amounts, within sixty days after receipt.',
      },
      {
        name: 'Indemnity And Subrogation',
        text: 'Upon any payment under the bond, the Surety is subrogated to all rights of the Obligee and the claimant against the Principal, and is entitled to enforce its agreements of indemnity with the Principal and its indemnitors.',
      },
      {
        name: 'Termination And Continuation',
        text: 'Where the bond is issued for a term, it may be continued by continuation certificate, but the Surety’s aggregate liability for all terms combined shall not exceed the Penal Sum, and the Surety may cancel a cancellable bond by giving the Obligee thirty days written notice, or such longer notice as statute requires.',
      },
    ],
    endorsements: [
      {
        suffixNo: '3115',
        title: 'Penal Sum Increase Rider',
        body: 'A. Increase. Effective on the date shown in the Schedule, the Penal Sum of the bond is increased to the amount shown in the Schedule, in consideration of the additional premium stated.\nB. Application. The increase applies only to defaults declared and claims arising on or after the effective date of this rider, and the Surety’s aggregate liability for the entire bond term shall not exceed the increased Penal Sum.',
      },
      {
        suffixNo: '3230',
        title: 'Multiple Obligee Rider',
        body: 'A. Additional Obligees. The persons or organizations named in the Schedule are added as Obligees under the bond, as their interests may appear.\nB. Conditions. No Obligee may recover except on the same conditions applicable to the original Obligee, the aggregate liability of the Surety to all Obligees shall not exceed the Penal Sum, and any payment by the Surety to one Obligee reduces the Penal Sum available to all.\nC. Default By An Obligee. The Surety has no obligation to any Obligee that has failed to perform its own obligations to the Principal under the Bonded Contract.',
      },
    ],
    decItems: [
      'Bond Number',
      'Principal Name And Address',
      'Obligee Name And Address',
      'Description Of Bonded Obligation Or Contract',
      'Penal Sum',
      'Bond Term Or Contract Date',
      'Premium And Rate Basis',
      'Executed Date And Attorney-In-Fact',
    ],
  },
  ENERGY_ENVIRONMENTAL: {
    key: 'ENERGY_ENVIRONMENTAL',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Pollution Condition',
        text: 'Pollution Condition means the discharge, dispersal, release, escape, migration or seepage of any solid, liquid, gaseous or thermal irritant or contaminant, including smoke, soot, vapors, fumes, acids, alkalis, chemicals, hazardous substances, petroleum hydrocarbons and waste, on, in, into or upon land, structures, the atmosphere, surface water or groundwater.',
      },
      {
        term: 'Covered Location',
        text: 'Covered Location means the location described in the Declarations, including energy production, processing, storage or distribution facilities at that location, that is owned, operated or leased by the Insured.',
      },
      {
        term: 'Cleanup Costs',
        text: 'Cleanup Costs means reasonable and necessary expenses, including legal expenses incurred with our consent, for the investigation, removal, remediation, neutralization or immobilization of a Pollution Condition to the extent required by environmental law, or as otherwise approved by us in writing.',
      },
      {
        term: 'Claim',
        text: 'Claim means a written demand received by the Insured seeking a remedy or alleging liability, including a government order or directive, arising out of a Pollution Condition.',
      },
      {
        term: 'Natural Resource Damages',
        text: 'Natural Resource Damages means damages assessed under environmental law for injury to, destruction of, or loss of land, fish, wildlife, biota, air, water, groundwater, drinking water supplies and other such resources held in trust by a government body.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Onsite Cleanup Of Pollution Conditions',
        text: 'We will pay Cleanup Costs the Insured incurs because of a Pollution Condition on, at or under a Covered Location, first discovered by the Insured during the policy period and reported to us as required by this policy.',
      },
      {
        name: 'Third-Party Liability',
        text: 'We will pay on behalf of the Insured amounts the Insured becomes legally obligated to pay as damages because of bodily injury, property damage or Natural Resource Damages resulting from a Pollution Condition migrating from a Covered Location, for Claims first made against the Insured during the policy period.',
      },
      {
        name: 'Transportation And Non-Owned Disposal Sites',
        text: 'We will pay Cleanup Costs and damages arising from a Pollution Condition caused by covered materials while in transit by a carrier under contract to the Insured, or at a non-owned disposal site named in the Declarations, for Claims first made during the policy period.',
      },
      {
        name: 'Business Interruption From Pollution',
        text: 'We will pay the actual loss of business income and necessary extra expense the Insured sustains due to the suspension of operations at a Covered Location, when the suspension is caused by a covered Pollution Condition, subject to the waiting period shown in the Declarations.',
      },
    ],
    limitsNote:
      'The Each Pollution Condition limit shown in the Declarations is the most we will pay for all Cleanup Costs, damages and expenses arising out of any one Pollution Condition, and the Policy Aggregate limit is the most we will pay under all insuring agreements combined for the policy period; legal defense expenses are part of and erode the limits. The self-insured retention shown in the Declarations applies to each Pollution Condition and must be paid by the Insured before we have any obligation, and a series of related, continuous or repeated Pollution Conditions arising from a common source is treated as one Pollution Condition first discovered when the earliest was discovered.',
    exclusions: [
      {
        name: 'Pre-Existing Known Conditions',
        text: 'This policy does not apply to a Pollution Condition existing before the inception date and known to a responsible officer of the Insured, unless disclosed in the application and listed in the Declarations as a scheduled known condition.',
      },
      {
        name: 'Intentional Noncompliance',
        text: 'This policy does not apply to Cleanup Costs or damages arising from the intentional, willful or deliberate noncompliance with any statute, regulation, order or instruction of a government body by a responsible officer of the Insured.',
      },
      {
        name: 'Contractual Liability',
        text: 'This policy does not apply to liability assumed under any contract or agreement, other than liability the Insured would have in the absence of the contract or under an insured contract listed in the Declarations.',
      },
      {
        name: 'Underground Storage Tanks',
        text: 'This policy does not apply to a Pollution Condition from an underground storage tank at a Covered Location unless the tank is scheduled in the Declarations, other than tanks unknown to the Insured at inception and discovered after the inception date.',
      },
      {
        name: 'Fines And Penalties',
        text: 'This policy does not apply to civil or criminal fines, penalties or punitive damages, except civil fines and penalties expressly insurable under the law of the jurisdiction where imposed.',
      },
      {
        name: 'Asbestos And Lead In Buildings',
        text: 'This policy does not apply to Cleanup Costs or damages arising from asbestos or lead-based paint in or on a building or structure, except as provided by endorsement.',
      },
    ],
    conditions: [
      {
        name: 'Reporting Of Pollution Conditions',
        text: 'The Insured must report a Pollution Condition to us as soon as practicable after discovery by a responsible officer, and in any event within thirty days, and must take reasonable emergency measures to abate an ongoing release; we will pay reasonable emergency response costs incurred in the first seven days without prior consent.',
      },
      {
        name: 'Consent To Incur Costs',
        text: 'Except for emergency measures, Cleanup Costs are covered only if incurred with our prior written consent, and we have the right to review and approve the remedial work plan, which approval will not be unreasonably withheld or delayed.',
      },
      {
        name: 'Defense And Settlement',
        text: 'We have the right and duty to defend any covered Claim, and the Insured may not settle any Claim, admit liability or incur defense expenses without our prior written consent; if the Insured refuses a settlement we recommend and the claimant would accept, our liability for the Claim will not exceed the recommended settlement amount plus defense expenses to the date of refusal.',
      },
      {
        name: 'Access And Cooperation',
        text: 'The Insured must provide us and our consultants reasonable access to the Covered Location and to all records relating to a Pollution Condition, and must cooperate in the investigation, remediation and defense of any matter under this policy.',
      },
      {
        name: 'Extended Reporting Period',
        text: 'If this policy is cancelled or not renewed other than for nonpayment, the named Insured may purchase an extended reporting period of up to three years, at the premium shown in the Declarations, for Claims first made during that period arising from Pollution Conditions commencing before the end of the policy period.',
      },
    ],
    endorsements: [
      {
        suffixNo: '4180',
        title: 'Scheduled Underground Storage Tank Coverage',
        body: 'A. Coverage. The underground storage tanks described in the Schedule are Covered Locations for corrective action costs and third-party liability required under the applicable financial responsibility regulations, subject to the per-tank limit shown in the Schedule.\nB. Compliance Warranty. Coverage applies only while each scheduled tank is maintained in compliance with the applicable leak detection, corrosion protection and overfill prevention requirements.\nC. Certification. This endorsement is intended to provide evidence of financial responsibility for the scheduled tanks under the applicable regulations, and its terms will be construed accordingly.',
      },
      {
        suffixNo: '4295',
        title: 'Renewable Operations Extension',
        body: 'A. Extension. Covered Location is extended to include the wind, solar or battery storage facilities described in the Schedule, including Pollution Conditions arising from transformer oils, battery electrolyte or firefighting runoff at those facilities.\nB. Decommissioning. We will also pay Cleanup Costs arising from a covered Pollution Condition discovered during decommissioning activities at a scheduled facility, provided the activities are completed within the policy period or any extended reporting period.',
      },
    ],
    decItems: [
      'Named Insured And Address',
      'Covered Locations Schedule',
      'Policy Period And Continuity Date',
      'Limit Each Pollution Condition',
      'Policy Aggregate Limit',
      'Self-Insured Retention And Waiting Periods',
      'Scheduled Known Conditions And Tanks',
      'Total Policy Premium',
    ],
  },
  POLITICAL_SPECIALTY: {
    key: 'POLITICAL_SPECIALTY',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Insured Investment',
        text: 'Insured Investment means the equity interest, loan, physical assets or contractual entitlement of the Insured in the foreign enterprise or project described in the Declarations, located in the host country named in the Declarations.',
      },
      {
        term: 'Expropriation',
        text: 'Expropriation means an act or series of acts of the host country government that deprives the Insured of its fundamental rights in the Insured Investment for a continuous period exceeding the waiting period shown in the Declarations, without adequate compensation, including nationalization, confiscation and measures tantamount to expropriation.',
      },
      {
        term: 'Currency Inconvertibility',
        text: 'Currency Inconvertibility means the inability of the Insured, for the waiting period shown in the Declarations, to convert local currency amounts derived from the Insured Investment into the policy currency, or to transfer converted amounts outside the host country, resulting from host government action or failure to act.',
      },
      {
        term: 'Insured Buyer',
        text: 'Insured Buyer means, with respect to trade credit coverage, a buyer named in or qualifying under the Declarations to whom the Insured has delivered goods or services on credit terms in the ordinary course of business.',
      },
      {
        term: 'Insured Event',
        text: 'Insured Event means an Expropriation, Currency Inconvertibility, political violence loss, protracted default or insolvency of an Insured Buyer, or a government-mandated or safety-driven recall of the Insured’s product, according to the coverage sections shown in the Declarations.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Expropriation And Political Violence',
        text: 'We will indemnify the Insured for the net loss of its Insured Investment directly caused by an Expropriation, or by physical damage to the assets of the Insured Investment directly caused by war, revolution, insurrection, terrorism or civil commotion in the host country, occurring during the policy period.',
      },
      {
        name: 'Currency Inconvertibility And Transfer',
        text: 'We will indemnify the Insured for the policy-currency equivalent of local currency amounts affected by Currency Inconvertibility, upon assignment to us of the Insured’s rights in the affected local currency, valued at the exchange rate prevailing on the date the waiting period expires.',
      },
      {
        name: 'Trade Credit - Protracted Default And Insolvency',
        text: 'We will indemnify the Insured, at the insured percentage shown in the Declarations, for loss arising from the failure of an Insured Buyer to pay an undisputed trade receivable within the protracted default waiting period, or from the insolvency of an Insured Buyer, for shipments or services invoiced during the policy period.',
      },
      {
        name: 'Product Recall Expense',
        text: 'We will indemnify the Insured for the reasonable and necessary recall expenses incurred because of a recall of the Insured’s product first initiated during the policy period, where consumption or use of the product has caused or would cause bodily injury or property damage, including notification, shipping, warehousing and destruction costs.',
      },
    ],
    limitsNote:
      'The limit shown in the Declarations for each coverage section is the most we will pay for all loss under that section during the policy period, and the Policy Aggregate limit is the most we will pay under all sections combined. Every loss is subject to the waiting period, insured percentage and deductible shown in the Declarations for the applicable section, and the Insured shall retain uninsured, for its own account, the portion of every loss corresponding to the uninsured percentage.',
    exclusions: [
      {
        name: 'Lawful Regulation',
        text: 'We will not indemnify loss arising from bona fide, non-discriminatory measures of general application taken by the host government in the legitimate exercise of its regulatory, taxation or public order powers, unless such measures are a disguised form of Expropriation.',
      },
      {
        name: 'Provocation And Illegal Conduct',
        text: 'We will not indemnify loss caused by or resulting from the unreasonable provocative act, breach of law or breach of contract by the Insured, its agents or the foreign enterprise, including the failure to obtain or maintain a required license or authorization.',
      },
      {
        name: 'Currency Fluctuation',
        text: 'We will not indemnify loss caused by the devaluation, depreciation or fluctuation in value of any currency, as distinct from the inability to convert or transfer it.',
      },
      {
        name: 'Trade Disputes',
        text: 'Under trade credit coverage, we will not indemnify any receivable that is subject to a bona fide dispute between the Insured and the Insured Buyer, until the dispute is resolved in the Insured’s favor by judgment, award or written settlement.',
      },
      {
        name: 'Pre-Existing Circumstances',
        text: 'We will not indemnify loss arising from an Insured Event, or circumstances reasonably expected to give rise to an Insured Event, existing or known to the Insured at inception.',
      },
      {
        name: 'Nuclear And Radioactive Contamination',
        text: 'We will not indemnify loss directly or indirectly caused by ionizing radiation, radioactive contamination, or the detonation of any nuclear device, however caused.',
      },
    ],
    conditions: [
      {
        name: 'Notice And Waiting Periods',
        text: 'The Insured must notify us in writing as soon as practicable, and in any event within sixty days, of any Insured Event or circumstance reasonably likely to give rise to one, and no claim is payable until the applicable waiting period has expired and the loss has continued throughout it.',
      },
      {
        name: 'Loss Minimization',
        text: 'The Insured must take all reasonable measures to avoid or minimize loss, including pursuing available legal and administrative remedies in the host country, maintaining credit management procedures for Insured Buyers, and observing the stop-shipment obligations stated in the Declarations after an Insured Buyer falls overdue.',
      },
      {
        name: 'Assignment And Recoveries',
        text: 'Upon payment of a claim, the Insured shall assign to us, at our request, its rights, title and interest in the Insured Investment or receivable to the extent of the payment, and all recoveries, net of collection costs, shall be shared between us and the Insured in proportion to our respective interests in the loss.',
      },
      {
        name: 'Confidentiality',
        text: 'The Insured shall not disclose the existence or terms of this policy to the host government or any third party, other than its lenders, auditors and professional advisers under obligations of confidence, except as required by law; unauthorized disclosure that materially prejudices us may reduce or void coverage for an affected loss.',
      },
      {
        name: 'Arbitration Of Disputes',
        text: 'Any dispute arising out of or relating to this policy shall be finally settled by binding arbitration before three arbitrators seated in the city named in the Declarations, applying the governing law shown in the Declarations, and the award shall be enforceable in any court of competent jurisdiction.',
      },
    ],
    endorsements: [
      {
        suffixNo: '5170',
        title: 'Contract Frustration Extension',
        body: 'A. Extension. Coverage is extended to the non-payment or non-honoring by a government or state-owned entity of its obligations under the contract described in the Schedule, where the failure continues beyond the waiting period shown in the Schedule and does not result from a bona fide dispute.\nB. Documentation. As a condition of payment, the Insured must provide the underlying contract, evidence of performance of its own obligations, and evidence of demand for payment upon the obligor.',
      },
      {
        suffixNo: '5260',
        title: 'Named Buyer Limit Schedule',
        body: 'A. Buyer Limits. The credit limit shown in the Schedule for each named Insured Buyer is the most we will pay for all loss with respect to that buyer, in place of any discretionary limit provisions of this policy.\nB. Adjustment. We may reduce or withdraw a scheduled buyer limit prospectively by written notice, and the reduction applies only to shipments made after the effective date of the notice.',
      },
    ],
    decItems: [
      'Named Insured And Address',
      'Host Country Or Insured Buyer Portfolio',
      'Coverage Sections Purchased',
      'Policy Period',
      'Section Limits And Policy Aggregate',
      'Waiting Periods Insured Percentage And Deductibles',
      'Governing Law And Arbitration Seat',
      'Total Policy Premium',
    ],
  },
  ACCIDENT_HEALTH: {
    key: 'ACCIDENT_HEALTH',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Covered Person',
        text: 'Covered Person means a person in an eligible class described in the Declarations for whom premium has been paid and whose coverage under this policy has become effective and has not terminated.',
      },
      {
        term: 'Injury',
        text: 'Injury means bodily injury caused by an accident that occurs while the Covered Person is insured under this policy, and that results directly and independently of all other causes in a covered loss.',
      },
      {
        term: 'Sickness',
        text: 'Sickness means an illness, disease or condition of a Covered Person that first manifests itself while coverage is in force, where sickness benefits are shown in the Benefit Schedule.',
      },
      {
        term: 'Hospital',
        text: 'Hospital means an institution licensed as a hospital that operates primarily for the care and treatment of sick or injured persons on an inpatient basis, provides twenty-four-hour nursing service by registered nurses, and has facilities for diagnosis and major surgery or a formal arrangement with an institution that does.',
      },
      {
        term: 'Usual And Customary Charge',
        text: 'Usual And Customary Charge means the charge most commonly made by providers of comparable services and supplies in the geographic area where the service is rendered, not to exceed the charge actually made.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Accidental Death And Dismemberment',
        text: 'If Injury to a Covered Person results, within three hundred sixty-five days of the accident, in a loss listed in the Benefit Schedule, we will pay the percentage of the Principal Sum shown for that loss; if the Covered Person sustains more than one listed loss as the result of one accident, we will pay only the largest applicable percentage.',
      },
      {
        name: 'Accident Medical Expense',
        text: 'We will pay the Usual And Customary Charges incurred by a Covered Person for medically necessary treatment of an Injury, beginning within ninety days of the accident and incurred within the benefit period shown in the Benefit Schedule, in excess of the deductible and up to the medical expense maximum shown.',
      },
      {
        name: 'Weekly Accident Indemnity',
        text: 'If Injury causes a Covered Person to be wholly and continuously disabled and prevented from performing the material duties of their occupation, we will pay the weekly benefit shown in the Benefit Schedule, beginning after the elimination period and continuing for as long as the disability continues, up to the maximum benefit period shown.',
      },
      {
        name: 'Emergency Evacuation And Repatriation',
        text: 'When shown in the Benefit Schedule, we will pay the reasonable expenses incurred for the medically necessary emergency evacuation of a Covered Person to the nearest adequate medical facility, and for the repatriation of remains in the event of death, when the Injury or covered Sickness occurs more than one hundred miles from the Covered Person’s permanent residence.',
      },
    ],
    limitsNote:
      'The Principal Sum, benefit amounts, deductibles, elimination periods and maximum benefit periods applicable to each Covered Person are those shown in the Benefit Schedule for the Covered Person’s eligible class. If this policy insures multiple Covered Persons in a common accident, our total liability for all losses arising from that accident will not exceed the aggregate limit per accident shown in the Declarations, and benefits otherwise payable will be reduced proportionately among all Covered Persons.',
    exclusions: [
      {
        name: 'Self-Inflicted Injury',
        text: 'We will not pay benefits for a loss caused by or resulting from suicide, attempted suicide, or intentionally self-inflicted injury, while sane or insane.',
      },
      {
        name: 'Sickness And Disease',
        text: 'Unless a Sickness benefit is shown in the Benefit Schedule, we will not pay benefits for a loss caused by or resulting from sickness, disease, bodily or mental infirmity, or medical or surgical treatment of them, or bacterial infection except one occurring through an accidental wound.',
      },
      {
        name: 'War And Armed Service',
        text: 'We will not pay benefits for a loss caused by or resulting from declared or undeclared war or any act of war, or occurring while the Covered Person is serving on full-time active duty in the armed forces of any country, other than reserve training of thirty-one days or less.',
      },
      {
        name: 'Aviation Other Than Passenger',
        text: 'We will not pay benefits for a loss caused by or resulting from travel or flight in any aircraft, except as a fare-paying passenger on a regularly scheduled airline or charter flight operated by a licensed carrier.',
      },
      {
        name: 'Intoxication And Controlled Substances',
        text: 'We will not pay benefits for a loss caused by or resulting from the Covered Person’s operation of a motor vehicle while intoxicated as defined by the law of the jurisdiction where the accident occurs, or the voluntary taking of a controlled substance except as prescribed by a physician.',
      },
      {
        name: 'Hazardous Activities',
        text: 'We will not pay benefits for a loss caused by or resulting from participation in professional sports, racing on wheels, mountaineering requiring ropes or guides, parachuting or hang gliding, unless coverage for the activity is shown in the Benefit Schedule.',
      },
    ],
    conditions: [
      {
        name: 'Notice And Proof Of Loss',
        text: 'Written notice of claim must be given to us within thirty days after a covered loss begins, or as soon as reasonably possible, and written proof of loss must be furnished within ninety days after the date of loss; failure to furnish proof within that time will not invalidate a claim if it was not reasonably possible to do so, provided proof is furnished as soon as reasonably possible.',
      },
      {
        name: 'Physical Examination And Autopsy',
        text: 'We have the right, at our own expense, to have a Covered Person examined by a physician of our choice as often as reasonably necessary while a claim is pending, and to make an autopsy in the case of death where not forbidden by law.',
      },
      {
        name: 'Payment Of Claims',
        text: 'Benefits for loss of life will be paid to the beneficiary designated in writing, or if none survives, to the Covered Person’s estate; all other benefits will be paid to the Covered Person, and benefits will be paid within sixty days after receipt of due written proof of loss.',
      },
      {
        name: 'Legal Actions',
        text: 'No action at law or in equity may be brought to recover on this policy before the expiration of sixty days after written proof of loss has been furnished, nor after the expiration of three years from the time written proof of loss is required to be furnished.',
      },
      {
        name: 'Termination Of Coverage',
        text: 'Coverage for a Covered Person ends on the earliest of the date this policy terminates, the premium due date on which required premium is not paid subject to the grace period, or the date the person ceases to be in an eligible class; termination will not affect a claim for a covered loss that occurred while coverage was in force.',
      },
    ],
    endorsements: [
      {
        suffixNo: '6180',
        title: 'Out-Of-Country Medical Extension',
        body: 'A. Extension. Accident Medical Expense benefits are extended to cover Usual And Customary Charges for the treatment of an Injury or covered Sickness sustained while a Covered Person is traveling outside their country of permanent residence on a trip of no more than one hundred eighty consecutive days.\nB. Direct Payment. We may, at our option, pay covered providers directly, and any such payment discharges our obligation to the extent of the payment.\nC. Coordination. Benefits under this extension are excess over any government or employer-sponsored health plan under which the Covered Person is entitled to benefits.',
      },
      {
        suffixNo: '6295',
        title: 'Felonious Assault And Business Travel Benefit',
        body: 'A. Benefit. If a Covered Person sustains an Injury as the direct result of a felonious assault occurring while on the business of the policyholder, and the Injury results in a loss payable under the Accidental Death And Dismemberment benefit, we will pay an additional amount equal to the percentage of the Principal Sum shown in the Schedule.\nB. Limitation. No benefit is payable if the assault is committed by a member of the Covered Person’s family or household, or by a fellow employee acting on personal motives known to the Covered Person.',
      },
    ],
    decItems: [
      'Policyholder And Address',
      'Eligible Classes Of Covered Persons',
      'Policy Period And Premium Due Dates',
      'Principal Sum By Class',
      'Benefit Schedule - Medical Weekly And Evacuation',
      'Aggregate Limit Per Accident',
      'Elimination And Benefit Periods',
      'Total Premium And Rate Basis',
    ],
  },
  AVIATION: {
    key: 'AVIATION',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Insured Aircraft',
        text: 'Insured Aircraft means the aircraft described in the Declarations by manufacturer, model and registration mark, including its engines, propellers, operating and navigation instruments, and equipment usually installed in the aircraft while installed or temporarily removed for service.',
      },
      {
        term: 'In Flight',
        text: 'In Flight means the period from the moment the Insured Aircraft moves forward in taking off or attempting to take off, while in the air, and until it completes its landing run; a rotorcraft is In Flight while its rotors are in motion under power.',
      },
      {
        term: 'In Motion',
        text: 'In Motion means while the Insured Aircraft is moving under its own power or the momentum generated by it, or while it is In Flight.',
      },
      {
        term: 'Approved Pilot',
        text: 'Approved Pilot means a pilot named in the Declarations, or a pilot meeting the certificate, rating, total hour and make-and-model requirements stated in the Declarations, holding a valid and effective medical certificate.',
      },
      {
        term: 'Purpose Of Use',
        text: 'Purpose Of Use means the use of the Insured Aircraft stated in the Declarations, and no coverage applies while the aircraft is used for any purpose not so stated.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Aircraft Liability - Bodily Injury And Property Damage',
        text: 'We will pay on behalf of the Insured all sums the Insured becomes legally obligated to pay as damages because of bodily injury or property damage caused by an occurrence arising out of the ownership, maintenance or use of the Insured Aircraft, and we will defend any suit against the Insured seeking such damages, even if groundless, false or fraudulent.',
      },
      {
        name: 'Aircraft Physical Damage - Hull All Risks',
        text: 'We will pay for direct physical loss of or damage to the Insured Aircraft, including disappearance if the aircraft is unreported for sixty days after commencing a flight, on an agreed value basis as shown in the Declarations, separately stated for loss occurring while the aircraft is In Motion and while it is not In Motion.',
      },
      {
        name: 'Medical Payments',
        text: 'We will pay reasonable medical, surgical, ambulance and hospital expenses incurred within one year of the accident for bodily injury sustained by each passenger while in, boarding or alighting from the Insured Aircraft, up to the limit per passenger shown in the Declarations, regardless of fault.',
      },
    ],
    limitsNote:
      'The limit of liability shown in the Declarations for each occurrence is the most we will pay for all damages because of bodily injury and property damage arising out of any one occurrence, and where a passenger sublimit is shown, that sublimit is the most we will pay for bodily injury to any one passenger. The agreed value stated in the Declarations is the most we will pay for physical loss of the Insured Aircraft, and payment of the agreed value for a total loss entitles us to the salvage; the deductibles shown for In Motion and not In Motion loss apply separately to each physical damage loss, but no deductible applies to a loss caused by fire, lightning, explosion, theft or vandalism while the aircraft is not In Motion.',
    exclusions: [
      {
        name: 'Unapproved Pilot Or Use',
        text: 'This policy does not apply while the Insured Aircraft is operated In Flight by any person other than an Approved Pilot, or while used for any purpose other than the stated Purpose Of Use, or for any unlawful purpose.',
      },
      {
        name: 'Airworthiness Violation',
        text: 'This policy does not apply while the airworthiness certificate of the Insured Aircraft is not in full force and effect, or while the aircraft is operated in violation of an applicable airworthiness directive of the civil aviation authority, if the violation causes or contributes to the loss.',
      },
      {
        name: 'Geographic Limits',
        text: 'This policy does not apply to any occurrence or loss that takes place outside the geographic limits stated in the Declarations, except while the aircraft is being transported by a common carrier between points within those limits.',
      },
      {
        name: 'Wear Tear And Mechanical Breakdown',
        text: 'Under the physical damage coverage, we will not pay for loss caused by and confined to wear and tear, deterioration, freezing, or mechanical, structural or electrical breakdown or failure, unless the result is a fire, explosion or forced landing, and then only for the resulting loss.',
      },
      {
        name: 'War Hijacking And Nuclear',
        text: 'This policy does not apply to loss or liability caused by war, invasion, civil war, rebellion, hijacking or any unlawful seizure or exercise of control of the aircraft, confiscation by order of any government, or ionizing radiation or radioactive contamination, unless war risk coverage is added by endorsement.',
      },
      {
        name: 'Liability To Employees',
        text: 'The liability coverage does not apply to bodily injury to an employee of the Insured injured in the course of employment by the Insured, or to any obligation under a workers compensation or similar law.',
      },
    ],
    conditions: [
      {
        name: 'Duties After Occurrence Or Loss',
        text: 'In the event of an occurrence or loss, the Insured must give us prompt written notice with particulars, protect the Insured Aircraft from further loss, cooperate fully in any investigation, defense or settlement, and, in the case of theft or vandalism, promptly notify the police and the appropriate civil aviation authority where required.',
      },
      {
        name: 'No Abandonment And Salvage',
        text: 'There can be no abandonment of the Insured Aircraft to us without our consent; if we pay for a total loss, we may take the aircraft and its salvage, and the Insured must execute the documents necessary to transfer title.',
      },
      {
        name: 'Repairs And Valuation Of Partial Loss',
        text: 'In the event of repairable damage, we will pay the reasonable cost of repair with materials of like kind and quality plus the reasonable cost of transporting the aircraft or parts to and from the place of repair, not exceeding the agreed value less salvage; repairs must not begin without our consent except for emergency measures necessary to protect the aircraft.',
      },
      {
        name: 'Change In Ownership Or Use',
        text: 'Coverage is void as to any loss occurring after a sale, assignment or transfer of the Insured’s interest in the Insured Aircraft, or a material change in the Purpose Of Use or base of operations, without our prior written consent.',
      },
      {
        name: 'Cancellation',
        text: 'The named Insured may cancel this policy at any time by written notice; we may cancel by mailing at least ten days notice for nonpayment of premium, or thirty days notice in all other cases, and the earned premium will be computed pro rata.',
      },
    ],
    endorsements: [
      {
        suffixNo: '7160',
        title: 'War Hijacking And Allied Perils Hull Coverage',
        body: 'A. Coverage. Notwithstanding the War Hijacking And Nuclear exclusion, we will pay for physical loss of or damage to the Insured Aircraft caused by war, invasion, civil war, rebellion, hijacking or unlawful seizure, strikes, riots, civil commotions, malicious acts and sabotage, and confiscation by order of a foreign government.\nB. Excluded Perils. This endorsement does not cover loss caused by the detonation of any nuclear device, war between any of the major powers named in the Schedule, or confiscation by the government of the aircraft’s state of registration.\nC. Review And Cancellation. Coverage under this endorsement may be cancelled or its premium and geographic scope revised by us on seven days written notice, or automatically upon the outbreak of war between the major powers named in the Schedule.',
      },
      {
        suffixNo: '7285',
        title: 'Temporary Substitute And Non-Owned Aircraft',
        body: 'A. Coverage. The liability coverage of this policy extends to the Insured’s use of a non-owned aircraft of similar type while the Insured Aircraft is withdrawn from normal use for maintenance, repair or overhaul, and to occasional use of other non-owned aircraft operated by an Approved Pilot.\nB. Limitation. This extension does not apply to physical damage to the non-owned aircraft itself, and the insurance afforded is excess over any other insurance available to the Insured.',
      },
    ],
    decItems: [
      'Named Insured And Address',
      'Insured Aircraft Make Model And Registration Mark',
      'Agreed Value Of Insured Aircraft',
      'Purpose Of Use',
      'Approved Pilots Or Pilot Requirements',
      'Liability Limit Each Occurrence And Passenger Sublimit',
      'In Motion And Not In Motion Deductibles And Geographic Limits',
      'Total Policy Premium',
    ],
  },
  REINSURANCE_TREATY: {
    key: 'REINSURANCE_TREATY',
    documentKind: 'treaty-wording',
    definitions: [
      {
        term: 'Company',
        text: 'Company means the ceding insurer named in the treaty schedule, including all companies under common management and control listed there, whose subject business is reinsured under this agreement.',
      },
      {
        term: 'Reinsurer',
        text: 'Reinsurer means the subscribing reinsurer or reinsurers executing this agreement, each for its own several share as stated in its signing page and not one for another.',
      },
      {
        term: 'Ultimate Net Loss',
        text: 'Ultimate Net Loss means the sum actually paid by the Company in settlement of losses under Policies covered hereunder, including loss adjustment expense, after deduction of all salvages, recoveries and inuring reinsurance, whether recovered or not.',
      },
      {
        term: 'Loss Occurrence',
        text: 'Loss Occurrence means all individual losses arising out of and directly occasioned by one catastrophe or event; the duration and extent of any Loss Occurrence arising from windstorm, hail or tornado is limited to all losses sustained during any period of seventy-two consecutive hours selected by the Company.',
      },
      {
        term: 'Policies',
        text: 'Policies means all binders, policies, contracts and other obligatory evidences of insurance, whether written or oral, issued by the Company and classified by it as the business described in the treaty schedule.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Reinsuring Clause',
        text: 'The Reinsurer agrees to indemnify the Company, on an excess of loss basis, for the amount of Ultimate Net Loss each Loss Occurrence arising under Policies in force at inception or issued or renewed during the term of this agreement, in excess of the Company retention and up to the Reinsurer limit stated in the treaty schedule, subject to the terms and conditions of this agreement.',
      },
      {
        name: 'Term And Special Termination',
        text: 'This agreement applies to Loss Occurrences commencing during the twelve-month period stated in the treaty schedule; either party may terminate at any anniversary by giving not less than ninety days prior written notice, and the Company may terminate immediately upon the Reinsurer’s insolvency, assignment for the benefit of creditors, or reduction of policyholders surplus by more than the percentage stated in the treaty schedule.',
      },
      {
        name: 'Reinstatement',
        text: 'In the event of the whole or any portion of the Reinsurer limit being exhausted by a Loss Occurrence, the amount so exhausted shall be automatically reinstated from the time of the Loss Occurrence for the remainder of the term, subject to payment of the reinstatement premium calculated pro rata as to amount, and subject to the number of reinstatements stated in the treaty schedule.',
      },
    ],
    limitsNote:
      'The Reinsurer shall be liable only for the amount of Ultimate Net Loss each Loss Occurrence in excess of the Company retention stated in the treaty schedule, and its liability shall not exceed the limit each Loss Occurrence nor the aggregate limit for the term, both as stated in the treaty schedule. The retention and limit apply irrespective of the number of Policies or interests involved, and nothing in this agreement shall be construed to create any right or legal relation between the Reinsurer and any policyholder or claimant of the Company.',
    exclusions: [
      {
        name: 'Excluded Classes',
        text: 'This agreement does not cover business classified by the Company as accident and health, fidelity and surety, financial guarantee, or credit insurance, nor reinsurance assumed by the Company other than local agency reinsurance on the classes covered hereunder.',
      },
      {
        name: 'War Risk',
        text: 'This agreement does not cover loss or liability arising from war, invasion, act of foreign enemy, hostilities whether war be declared or not, civil war, rebellion, insurrection, or military or usurped power, except to the extent such loss is covered under the Company’s Policies by standard riot and civil commotion provisions.',
      },
      {
        name: 'Nuclear Incident',
        text: 'This agreement is subject to the Nuclear Incident Exclusion Clauses, physical damage and liability, as attached to and forming part of this agreement, which exclude loss arising from nuclear reaction, nuclear radiation and radioactive contamination as there provided.',
      },
      {
        name: 'Insolvency Funds',
        text: 'This agreement excludes all liability of the Company arising from its participation or membership in any insolvency fund, guaranty association or similar plan, including assessments and their equivalents.',
      },
      {
        name: 'Pools And Associations',
        text: 'This agreement excludes business derived from the Company’s participation in any pool, syndicate or association, and any assessment or assumed liability arising from mandatory participation in a residual market mechanism, except as specially accepted by the Reinsurer in writing.',
      },
      {
        name: 'Ex-Gratia Payments',
        text: 'This agreement does not cover ex-gratia payments, nor any payment made by the Company where no liability existed under its Policies, unless made with the prior consent of the Reinsurer.',
      },
    ],
    conditions: [
      {
        name: 'Claims Notification And Cooperation',
        text: 'The Company shall advise the Reinsurer promptly of any Loss Occurrence likely to involve this agreement and of all subsequent material developments, and the Reinsurer, through its appointed representatives, shall have the right to cooperate with the Company in the investigation, adjustment and settlement of any claim involving this agreement.',
      },
      {
        name: 'Loss Settlements Binding',
        text: 'All loss settlements made by the Company, whether by way of compromise or otherwise, shall be unconditionally binding upon the Reinsurer, provided such settlements are within the terms of this agreement, and the Reinsurer shall pay its share of each settlement promptly upon receipt of proof of loss and payment by the Company.',
      },
      {
        name: 'Access To Records',
        text: 'The Reinsurer or its designated representatives shall have free access, at all reasonable times, to the books and records of the Company relating to the business reinsured hereunder, and this right of access shall survive the termination of this agreement until all obligations under it have been finally discharged.',
      },
      {
        name: 'Currency Errors And Omissions',
        text: 'All premiums and losses under this agreement are payable in the currency stated in the treaty schedule, and any inadvertent error, omission or delay by either party in complying with the terms of this agreement shall not relieve the other party of any obligation, provided the error or omission is rectified promptly upon discovery.',
      },
      {
        name: 'Arbitration',
        text: 'Any dispute arising out of or relating to this agreement, including its formation and validity, shall be referred to a panel of three arbitrators, one appointed by each party and the third by the two so appointed, all of whom shall be active or retired executives of insurance or reinsurance companies; the panel shall interpret this agreement as an honorable engagement rather than merely as a legal obligation, the seat of arbitration shall be the city stated in the treaty schedule, and the decision of the majority shall be final and binding on both parties.',
      },
      {
        name: 'Insolvency Of The Company',
        text: 'In the event of the insolvency of the Company, the reinsurance provided by this agreement shall be payable directly to the Company, its liquidator, receiver or statutory successor, on the basis of the liability of the Company without diminution because of the insolvency, and the Reinsurer shall be given written notice of the pendency of each claim against the Company with the right to investigate and interpose defenses at its own expense.',
      },
    ],
    endorsements: [
      {
        suffixNo: '8110',
        title: 'Extended Loss Occurrence Hours Amendment',
        body: 'A. Amendment. The definition of Loss Occurrence is amended so that, as respects loss arising from riot, civil commotion and vandalism, the period of consecutive hours is extended to the number of hours stated in the Schedule, and as respects earthquake, to one hundred sixty-eight consecutive hours.\nB. Election. The Company may elect the commencement time of any period of consecutive hours, provided no two elected periods overlap and each includes at least one individual loss to the Company.',
      },
      {
        suffixNo: '8235',
        title: 'Special Acceptance Of Excluded Business',
        body: 'A. Special Acceptance. The business described in the Schedule, though otherwise excluded, is specially accepted under this agreement upon the terms and for the additional premium stated in the Schedule.\nB. Duration. Each special acceptance applies from the date stated until the earlier of the expiry of this agreement or the withdrawal of the acceptance by the Reinsurer on not less than sixty days written notice, which withdrawal shall not affect Policies already ceded.',
      },
    ],
    decItems: [
      'Ceding Company And Domicile',
      'Subscribing Reinsurers And Several Shares',
      'Business Covered And Territory',
      'Term Of Agreement',
      'Company Retention Each Loss Occurrence',
      'Reinsurer Limit And Reinstatements',
      'Premium Rate Minimum And Deposit Premium',
      'Currency And Arbitration Seat',
    ],
  },
  LONDON_MARKET: {
    key: 'LONDON_MARKET',
    documentKind: 'binder',
    definitions: [
      {
        term: 'Coverholder',
        text: 'Coverholder means the intermediary named in the risk details, authorized under this binding authority agreement to bind insurances on behalf of the Underwriters within the terms and limits set out herein.',
      },
      {
        term: 'Underwriters',
        text: 'Underwriters means the subscribing insurers or syndicates whose proportions are set out in the security details, each of whom is bound severally for its own proportion and not jointly with the others.',
      },
      {
        term: 'Slip',
        text: 'Slip means the market reform contract document recording the risk details, information, security details and subscription agreement terms on the basis of which this contract is bound.',
      },
      {
        term: 'Binding Authority Period',
        text: 'Binding Authority Period means the period set out in the risk details during which the Coverholder may bind insurances hereunder, each insurance to run for its own period not exceeding twelve months plus odd time not exceeding eighteen months in all.',
      },
      {
        term: 'Gross Premium',
        text: 'Gross Premium means the premium charged to the insured before deduction of any commission, brokerage or other acquisition cost, and before any premium tax.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Risk Details And Interest',
        text: 'The Underwriters agree to insure the interest described in the risk details, on the conditions, wordings and clauses identified therein, for the period and within the territorial limits stated, in consideration of the premium stated in the risk details and payable under the premium payment terms.',
      },
      {
        name: 'Binding Authority Grant',
        text: 'The Underwriters authorize the Coverholder to bind insurances falling within the classes, limits and territorial scope set out in the risk details during the Binding Authority Period, provided that no insurance may be bound outside the stated underwriting guidelines and rating parameters without the prior written agreement of the leading Underwriter.',
      },
      {
        name: 'Claims Authority',
        text: 'Claims arising under insurances bound hereunder shall be handled by the party named in the risk details, with authority to adjust and settle claims up to the amount stated therein; claims exceeding that authority, and all claims involving denial of liability, shall be referred to the leading Underwriter for instruction before settlement.',
      },
    ],
    limitsNote:
      'The maximum limit of liability any one risk which the Coverholder may bind is stated in the risk details, and the aggregate limit for all insurances bound during the Binding Authority Period, where stated, shall not be exceeded. Each Underwriter’s liability is several and limited to the proportion set out against its name in the security details, and the premium payment condition requires settlement of premium to the Underwriters within the number of days stated, failing which the leading Underwriter may cancel the affected insurance by notice as provided in the premium payment clause.',
    exclusions: [
      {
        name: 'War And Civil War',
        text: 'Insurances bound hereunder exclude loss or damage occasioned by war, invasion, hostilities, civil war, rebellion, revolution, or military or usurped power, in accordance with the market war exclusion wording identified in the risk details.',
      },
      {
        name: 'Radioactive Contamination',
        text: 'Insurances bound hereunder are subject to the radioactive contamination and nuclear exclusion clauses identified in the risk details, excluding loss arising from ionizing radiation, radioactive contamination and nuclear assemblies.',
      },
      {
        name: 'Cyber Clarification',
        text: 'Insurances bound hereunder are subject to the cyber loss clarification wording identified in the risk details, excluding loss directly caused by the failure or malicious manipulation of computer systems, except as expressly written back therein.',
      },
      {
        name: 'Sanctions Limitation',
        text: 'No Underwriter shall be deemed to provide cover or be liable to pay any claim to the extent that doing so would expose that Underwriter to any sanction, prohibition or restriction under applicable trade or economic sanctions laws or regulations.',
      },
      {
        name: 'Excluded Classes And Territories',
        text: 'The Coverholder shall not bind any insurance in the classes or territories listed as excluded in the risk details, nor any risk of a kind identified in the underwriting guidelines as requiring prior submission to the leading Underwriter.',
      },
    ],
    conditions: [
      {
        name: 'Subjectivities',
        text: 'Where the risk details state subjectivities, the insurance is bound subject to their satisfaction within the time stated; if a subjectivity is not satisfied within that time, the leading Underwriter may cancel the insurance from inception or vary its terms, on notice to the Coverholder and the insured.',
      },
      {
        name: 'Bordereaux And Reporting',
        text: 'The Coverholder shall submit to the Underwriters, within the number of days stated in the risk details after the end of each month, premium and claims bordereaux in the agreed format, recording each insurance bound, the Gross Premium, and all paid and outstanding claims.',
      },
      {
        name: 'Premium Payment And Accounting',
        text: 'The Coverholder shall hold all premiums as fiduciary funds in accordance with the terms of business agreement, and shall remit premiums to the Underwriters, net only of the deductions stated in the risk details, within the settlement period stated therein.',
      },
      {
        name: 'Inspection Of Records',
        text: 'The Underwriters or their appointed representatives may, on reasonable notice, inspect and audit the Coverholder’s records relating to insurances bound hereunder, and this right shall continue after the expiry of the Binding Authority Period until all obligations hereunder have been discharged.',
      },
      {
        name: 'Choice Of Law And Jurisdiction',
        text: 'This contract is governed by the law stated in the risk details, and any dispute shall be subject to the exclusive jurisdiction of the courts, or the arbitration procedure, stated therein.',
      },
    ],
    endorsements: [
      {
        suffixNo: '9105',
        title: 'Addendum - Extension Of Binding Authority Period',
        body: 'A. Extension. The Binding Authority Period is extended to the date stated in the Schedule, on the existing terms and conditions, in consideration of the additional or adjusted premium provisions stated therein.\nB. Conditions Unchanged. All limits, guidelines and reporting obligations continue to apply throughout the extended period, and insurances bound during the extension shall not exceed the periods permitted by the original agreement.',
      },
      {
        suffixNo: '9220',
        title: 'Addendum - Revised Underwriting Guidelines',
        body: 'A. Revision. The underwriting guidelines referenced in the risk details are replaced by the revised guidelines attached to this addendum, with effect from the date stated in the Schedule.\nB. Application. Insurances bound before the effective date remain subject to the guidelines in force when they were bound.\nC. Referral. Risks falling outside the revised guidelines shall be individually referred to and agreed by the leading Underwriter before binding.',
      },
    ],
    decItems: [
      'Unique Market Reference',
      'Insured Or Coverholder Name And Address',
      'Type And Classes Of Business',
      'Period Or Binding Authority Period',
      'Limits Of Liability Any One Risk And Territorial Limits',
      'Premium And Payment Terms',
      'Security Details And Proportions',
      'Subjectivities',
    ],
  },
};
