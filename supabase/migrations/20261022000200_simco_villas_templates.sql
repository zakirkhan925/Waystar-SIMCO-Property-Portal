-- Installable document template set "plot_society_simco": the wording of SIMCO's Simco Villas
-- documents (Booking Form, Allotment Letter, Sale Agreement, Installment Schedule, Possession Letter, NDC).
-- Blanks in the originals are {{placeholders}} filled from project_document_settings or the deal.
--
-- Usage (Super Admin / Manager):  select public.install_document_templates('<project uuid>', 'plot_society_simco');
-- Existing active templates for that project are kept as older versions.

create or replace function public.install_document_templates(p_project_id uuid, p_set text)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  t record;
  n int := 0;
begin
  if p_set <> 'plot_society_simco' then
    raise exception 'Unknown template set %', p_set;
  end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Project not found';
  end if;

  for t in
    select * from (values
    ------------------------------------------------------------------ BOOKING FORM
    ('booking_form'::public.document_type, 'BOOKING FORM', 'BF', $json$[
      {"key":"documents","heading":"DOCUMENTS REQUIRED","style":"bullets","items":[
        "Copy of CNIC of Applicant (and Joint Applicant / Nominee, if any).",
        "Two recent passport-size photographs.",
        "Copy of NTN certificate / tax filer status (if applicable, for taxation purposes).",
        "Cheque / pay order / bank transfer proof for the booking amount."]},
      {"key":"terms","heading":"TERMS & CONDITIONS","style":"bullets","items":[
        "Booking is provisional until realization of the booking amount and issuance of the Allotment Letter; the Company reserves the right to reject any application, with the booking amount refunded in full in such case.",
        "Default in payment of any installment shall attract a penalty of 10% per month on the overdue amount. Failure to pay two (2) consecutive installments shall automatically cancel this booking, and the Seller shall deduct 20% of the total sale price before refunding the balance received after re-selling the plot, as per Company policy.",
        "There shall be no escalation in the agreed price after booking except due to unavoidable circumstances beyond the Seller's control (e.g. war, natural calamity, or change in government fiscal policy). Corner plots carry an additional 10% on the plot price.",
        "Any variance between the booked plot area and the actual plot area as per final demarcation shall be adjusted in the final price on a pro-rata basis.",
        "Physical possession shall rest with the Seller until full payment and applicable maintenance charges are cleared; utility and maintenance charges become payable from the date of the Seller's notice that the plot is ready for possession.",
        "Any change in plot, plan, or nominee is subject to management approval and applicable charges.",
        "Under the Full Payment plan, possession charges of 5% of the plot price are added before the applicable full-payment discount, as per the Company's current price list. Allocation is subject to availability.",
        "Voluntary cancellation and refund by the Applicant shall be governed by the Company's prevailing cancellation policy.",
        "All notices, reminders, and correspondence shall be sent to the mailing address, phone number, or email provided above; it is the Applicant's responsibility to inform the Company in writing of any change in contact details.",
        "This Booking Form is governed by, and subject to, the detailed Sale Agreement and Installment Payment Schedule to be executed subsequently, which shall prevail in case of any conflict."]},
      {"key":"declaration","heading":"DECLARATION","style":"paragraphs","items":[
        "I / We hereby apply for booking of the above plot in the project developed by SIMCO Developers and marketed by {{marketed_by}}. I / We confirm that the particulars given above are true and correct, that I / We have read and understood the Documents Required and Terms & Conditions stated above (or have had them explained where needed), and I / We voluntarily agree to be bound by them, along with the detailed Sale Agreement and Installment Payment Schedule applicable to this booking."]}
    ]$json$),
    ------------------------------------------------------------------ ALLOTMENT LETTER
    ('allotment_letter', 'ALLOTMENT LETTER', 'AL', $json$[
      {"key":"intro","heading":"","style":"paragraphs","items":[
        "Dear Sir / Madam,",
        "With reference to your Booking Form dated {{booking_date}} and the booking amount received, we are pleased to confirm the allotment of the following plot in your favor:"]},
      {"key":"terms","heading":"TERMS OF ALLOTMENT","style":"bullets","items":[
        "This allotment is subject to timely payment of all installments in accordance with the attached Installment Payment Schedule and the Sale Agreement.",
        "Default in payment attracts a penalty of 10% per month on the overdue amount. If two (2) consecutive installments remain unpaid, this allotment shall automatically stand cancelled, and the Company shall deduct 20% of the total sale price as cancellation charges before refunding the balance, after re-selling the plot, as per Company policy.",
        "If the Company fails to hand over possession of the plot within the agreed timeline (for reasons other than force majeure), the Company shall compensate the Allottee as set out in the Sale Agreement.",
        "Change of nomination, plot swap, or transfer of allotment is subject to prior written approval of the Company and applicable processing charges.",
        "Roads, open spaces, parks, the mosque, and common areas of the project remain common property for the benefit of all allottees and shall not be encroached upon, converted, or misused; no signboard or fixture may be placed on common areas without prior written permission of the Company.",
        "There shall be no escalation in price after booking except due to unavoidable circumstances beyond the Company's control, and any variance between booked and actual plot area (as per final demarcation) shall be adjusted pro-rata. Corner plots carry an additional 10% on the plot price.",
        "Possession shall be handed over upon completion of development and clearance of all dues, as communicated separately by the Company.",
        "The Allottee is responsible for keeping the Company informed in writing of any change in mailing address, phone number, or email; all notices sent to the last known contact details on record shall be deemed duly served.",
        "This letter should be read together with the Sale Agreement, which shall govern in case of any conflict."]},
      {"key":"clarifications","heading":"CLARIFICATIONS","style":"bullets","items":[
        "This Allotment Letter confirms the Company's acceptance of the Allottee in respect of the plot specified above; it does not, by itself, transfer title, ownership, or possession, which shall follow only after full payment and execution of the applicable transfer formalities.",
        "The Allottee is required to countersign and return the duplicate copy of this letter within {{allotment_countersign_days}} days; failure to do so does not affect the validity of this allotment or the Allottee's payment obligations.",
        "Any dispute regarding the particulars stated in this letter must be raised in writing within 7 (seven) days of receipt; the Company's record shall otherwise be treated as final and binding."]},
      {"key":"closing","heading":"","style":"paragraphs","items":[
        "Please sign and return the duplicate copy of this letter as a token of your acceptance of the above terms.",
        "We congratulate you on your investment and look forward to a long-term relationship."]}
    ]$json$),
    ------------------------------------------------------------------ SALE AGREEMENT
    ('sale_agreement', 'SALE AGREEMENT', 'SA', $json$[
      {"key":"parties","heading":"","style":"paragraphs","items":[
        "This Sale Agreement (\"Agreement\") is made and entered into on {{agreement_date}} at {{execution_city}}, between:",
        "{{seller_legal_name}}, {{seller_legal_status}}, with its registered office at {{seller_office_address}}, represented by its authorized signatory {{signatory_name}}, CNIC No. {{signatory_cnic}} (hereinafter referred to as the \"Seller\" / \"First Party\", which expression shall, unless repugnant to the context, include its successors, assigns, and legal representatives), of the ONE PART;",
        "AND",
        "{{purchaser_name}}, {{purchaser_relation}} {{purchaser_guardian}}, holder of CNIC No. {{purchaser_cnic}}, residing at {{purchaser_address}}, (hereinafter referred to as the \"Purchaser\" / \"Second Party\", which expression shall, unless repugnant to the context, include his/her heirs, successors, and permitted assigns/nominee(s)), of the OTHER PART.",
        "(The Seller and the Purchaser are hereinafter individually referred to as a \"Party\" and collectively as the \"Parties\".)"]},
      {"key":"recitals","heading":"RECITALS","style":"bullets","items":[
        "The Seller is the owner / developer of the project known as {{project_name}}, situated at {{project_address}} (Approval / NOC Ref. {{approval_noc_ref}}), and is fully authorized to develop, market, and sell plots therein.",
        "The Purchaser has applied for and been allotted Plot No. {{plot_no}}, vide Allotment Letter Ref. {{allotment_ref}} dated {{allotment_date}}.",
        "The Parties now wish to record the complete terms and conditions governing the sale of the said plot in this Agreement, so that both Parties are fully aware of their respective rights and obligations."]},
      {"key":"terms","heading":"TERMS & CONDITIONS","style":"clauses","items":[
        {"title":"Sale Consideration","text":"The total sale price of the plot is {{total_price}} (Rupees {{total_price_words}} Only), payable by the Purchaser to the Seller strictly in accordance with the Installment Payment Schedule annexed to and forming an integral part of this Agreement."},
        {"title":"Mode of Payment","text":"All payments shall be made by cross cheque, pay order, or bank transfer in favor of {{seller_account_title}}, and the Seller shall issue a Payment Receipt against each payment received."},
        {"title":"Development, Documentation & Registration","text":"The Seller shall be responsible for completing the development works of the project (including roads, utilities, and common amenities) and all paperwork relating to the plot, and shall execute the Sale Deed, registration, mutation, and transfer formalities in the name of the Purchaser on the date mutually agreed between the Parties. Possession of the plot shall be delivered by the Seller to the Purchaser on or before {{possession_timeline}}, subject to the Purchaser's compliance with the payment obligations under this Agreement. Any development charges payable by the Purchaser shall be as agreed between the Parties in writing."},
        {"title":"Default in Payment by Purchaser","text":"In the event of default in payment by the Purchaser, the Purchaser shall be liable to pay a penalty of 10% (ten percent) of the overdue amount per month for the period of delay. If the Purchaser fails to pay two (2) consecutive installments, this Agreement shall automatically be treated as cancelled without further notice. In such event, the Seller shall be entitled to deduct 20% (twenty percent) of the total sale consideration as cancellation charges, and shall refund the remaining amount(s) received to the Purchaser after re-selling the said plot to any other person/party, within {{refund_days_after_resale}} days of such re-sale."},
        {"title":"Delay in Possession by Seller","text":"If the Seller fails to hand over possession of the plot to the Purchaser within the stipulated period set out in Clause 3, unless such delay is caused by force majeure as set out in Clause 17, the Seller shall compensate the Purchaser at the rate / on the basis of {{delay_compensation_basis}} for the period of delay."},
        {"title":"Utility Bills & Maintenance","text":"Commencing from the date of written notice given by the Seller to the Purchaser that the plot is ready for possession, the Purchaser shall be liable to pay all applicable utility and maintenance charges in respect of the plot, whether or not physical possession has actually been taken. Notwithstanding the above, possession of the plot shall rest with the Seller until the Purchaser has made full payment of the sale consideration and all applicable maintenance amounts due."},
        {"title":"Transfer of Title","text":"The Seller shall be fully responsible for getting the plot transferred in favor of the Purchaser or his/her nominee(s), through registration of the Sale Deed at the office of the concerned Sub-Registrar and mutation in the revenue record (and with the relevant development authority, where applicable), upon receipt of full sale consideration and issuance of the No Dues Certificate (NDC). Ownership of the plot shall be transferred after payment of the applicable transfer fee, documentation charges, and other related expenses by the Purchaser."},
        {"title":"Taxes, Duties & Charges","text":"All statutory taxes, duties, stamp charges, transfer fees, and other government levies applicable on this transaction, whether at the time of booking, during construction, or at the time of transfer, shall be borne by the Purchaser unless otherwise agreed in writing."},
        {"title":"Common Areas & Design Guidelines","text":"All roads, open spaces, parks, the mosque, commercial areas, and amenities within the project are meant for the shared benefit of all purchasers/allottees and shall not be converted, encroached upon, or misused by the Purchaser. Construction on the plot shall conform to the design and elevation guidelines, if any, issued by the Seller to maintain a uniform appearance of the project, and no signboard or fixture may be placed on common areas without the prior written permission of the Seller."},
        {"title":"Plot Demarcation & Possession Charges","text":"The plot shall be demarcated on site in accordance with the approved master plan of the project. Possession charges, where applicable under the Purchaser's selected payment plan, shall be as stated in the Company's current price list, Booking Form, and Installment Payment Schedule."},
        {"title":"Price Escalation","text":"There shall be no escalation in the price of the plot agreed under this Agreement, except where such escalation arises due to unavoidable circumstances beyond the Seller's control, including but not limited to war, natural calamity, civil commotion, or a change in the fiscal policy of the Federal or Provincial Government. Corner plots carry an additional 10% on the plot price."},
        {"title":"Area Adjustment","text":"Upon final demarcation of the plot, any increase or decrease in the actual plot area compared to the area at the time of booking shall be adjusted in the final sale consideration on a pro-rata basis using the per-Marla / per-square-foot price agreed at booking."},
        {"title":"Utilities & Shared Infrastructure","text":"Where the concerned authority or utility provider is unable to provide a project-level utility connection (e.g. electricity, gas, or water) for any reason, any expenditure incurred by the Seller in this regard shall be shared equally among all allottees of the project."},
        {"title":"Seller's Title Warranty","text":"The Seller hereby assures and covenants with the Purchaser that the plot is free from all claims, liens, and encumbrances of whatsoever nature, and that the Seller has good right, clear title, and lawful authority to sell the said plot."},
        {"title":"Remedy on Seller's Default","text":"If the Seller refuses to complete this transaction, or fails to get title of the plot transferred in favor of the Purchaser or his/her nominee(s) as agreed, the Purchaser shall be entitled to seek completion of this Agreement through a court of law, at the sole risk and cost of the Seller, and any objection raised by the Seller in such proceedings shall not be considered a valid defense to the extent it contradicts the terms of this Agreement."},
        {"title":"Maintenance, Hygiene & Construction","text":"The Purchaser shall be responsible for keeping and maintaining the plot, and shall cooperate in maintaining the hygienic condition and cleanliness of the project as a whole. The Purchaser shall have no right to alter, add to, or damage common areas, boundary walls, roads, or utilities of the project without the prior written consent of the Seller. Construction on the plot shall be permitted only after payment of at least 80% (eighty percent) of the total sale consideration, subject to applicable approvals and the guidelines referred to in Clause 9."},
        {"title":"Force Majeure & Damage","text":"In case of fire, act of God, or any damage to the plot or project arising from causes beyond reasonable control, the Seller/developer shall not be held responsible for any resulting loss or damage caused to the Purchaser, except to the extent such loss arises from the Seller's proven negligence."},
        {"title":"Regulatory Objections","text":"If any government department, development authority, or other competent organization raises any objection concerning the project, both Parties shall cooperate in good faith to resolve the matter with the concerned authority. Any cost arising from such objections that is attributable to the Purchaser's specific plot or actions shall be borne by the Purchaser; costs attributable to the project as a whole shall be borne by the Seller, unless otherwise agreed in writing."},
        {"title":"Nomination / Transfer by Purchaser","text":"The Purchaser may not sell, transfer, or assign rights under this Agreement to any third party without prior written consent of the Seller, which shall not be unreasonably withheld, and subject to payment of the Seller's applicable transfer/processing fee."},
        {"title":"Cancellation by Purchaser & Refund","text":"Where the Purchaser voluntarily seeks cancellation of this Agreement (other than by reason of default under Clause 4), such cancellation and any resulting refund shall be governed by, and processed in accordance with, the Seller's cancellation policy as notified in writing to the Purchaser at the time of booking, including the deduction of applicable processing and cancellation charges."},
        {"title":"Amendments","text":"No variation, amendment, or waiver of any term of this Agreement shall be valid unless made in writing and signed by both Parties."},
        {"title":"Governing Law & Jurisdiction","text":"This Agreement shall be governed by the laws of Pakistan, and the courts having territorial jurisdiction over the project location (Taxila, District Rawalpindi) shall have exclusive jurisdiction over any dispute arising out of or in connection with this Agreement."},
        {"title":"Entire Agreement","text":"This Agreement, together with its Annexures (including the Installment Payment Schedule), constitutes the entire understanding between the Parties and supersedes all prior discussions, representations, or agreements, whether oral or written, relating to the subject matter herein."},
        {"title":"Notices & Communication","text":"Any notice, reminder, or communication required under this Agreement shall be sent in writing to the postal address, phone number, or email provided by the respective Party. Notices sent to the last known contact details on the Seller's record shall be deemed duly served. It is the Purchaser's responsibility to promptly inform the Seller in writing of any change in contact details."},
        {"title":"Severability","text":"If any clause or part of this Agreement is held to be invalid, illegal, or unenforceable under applicable law, the remaining clauses shall continue in full force and effect, and the Parties shall in good faith replace the invalid provision with a valid one that most closely reflects the original intent."}]},
      {"key":"declaration","heading":"DECLARATION BY THE PARTIES","style":"paragraphs","items":[
        "The Seller declares that all particulars of the project and plot given to the Purchaser, including price, size, specifications, and expected timelines, are true and correct to the best of its knowledge, and that it holds valid authority to sell the plot described in this Agreement.",
        "The Purchaser declares that he/she has read and understood each of the above clauses (or has had them explained where needed), has raised all questions prior to signing, and enters into this Agreement voluntarily and with full knowledge of the payment obligations, penalties, and rights and responsibilities of both Parties set out above.",
        "IN WITNESS WHEREOF, the Parties have set their hands on the date first written above."]}
    ]$json$),
    ------------------------------------------------------------------ INSTALLMENT SCHEDULE
    ('installment_schedule', 'INSTALLMENT PAYMENT SCHEDULE', 'IPS', $json$[
      {"key":"note","heading":"","style":"paragraphs","items":[
        "Note: This schedule applies to the Down Payment + Installments plan: 30% down payment at booking and the balance 70% in 8 equal quarterly installments. Amounts and dates above are indicative for this plot and shall be finalized at the time of booking. Under the Full Payment plan, a single payment is made as per the Company's current price list."]},
      {"key":"terms","heading":"TERMS & CONDITIONS","style":"bullets","items":[
        "Any payment received shall be adjusted against the oldest unpaid installment, unless otherwise agreed by the Company in writing.",
        "Early / advance payment of one or more future installments is permitted; any applicable rebate on early payment, if offered by the Company, shall be communicated separately in writing.",
        "This Schedule is indicative and shall be revised where the final plot area as per demarcation differs from the booked area (see Area Adjustment clause in the Sale Agreement), or where the Applicant's selected payment plan changes with the Company's written approval.",
        "All payments must be made in favor of the Company's designated account/title only; the Company shall not be responsible for payments made to any unauthorized individual or account."]}
    ]$json$),
    ------------------------------------------------------------------ POSSESSION LETTER
    ('possession_letter', 'POSSESSION LETTER', 'PL', $json$[
      {"key":"intro","heading":"","style":"paragraphs","items":[
        "Dear Sir / Madam,",
        "We are pleased to inform you that, having completed all requisite development and regulatory formalities, and having verified that all dues under your Sale Agreement / Installment Payment Schedule for Plot {{plot_no}}, {{project_name}} stand cleared as of {{dues_cleared_date}}, SIMCO Developers is now handing over physical possession of the said plot to you."]},
      {"key":"terms","heading":"TERMS OF HANDOVER","style":"bullets","items":[
        "Possession is granted in \"as-is\" condition as inspected and demarcated on site and acknowledged by the allottee at the time of handover.",
        "All applicable maintenance, utility connection, and society/association charges become payable by the allottee from the date of possession, or from the date of the Seller's earlier notice that the plot was ready for use, whichever is applicable under the Sale Agreement.",
        "Roads, open spaces, parks, the mosque, and all common areas of the project remain common property for the benefit of all allottees; the allottee shall not encroach upon, convert, or misuse them, and no signboard or fixture may be placed on common areas without prior written permission of SIMCO Developers.",
        "The allottee shall not alter, damage, or encroach upon boundary walls, roads, utilities, or common infrastructure of the project, and shall cooperate in maintaining the hygienic condition and cleanliness of the project.",
        "Any discrepancy in plot dimensions or boundary demarcation must be reported in writing within {{discrepancy_report_days}} days of this letter for rectification.",
        "In case of fire, act of God, or damage from causes beyond reasonable control, the Company shall not be held responsible for resulting loss to the allottee, except where such loss arises from the Company's proven negligence.",
        "This letter does not, by itself, constitute conveyance of title; transfer of title shall follow the process set out in the Sale Agreement, upon payment of transfer fee, documentation charges, and other related expenses by the allottee."]},
      {"key":"clarifications","heading":"CLARIFICATIONS","style":"bullets","items":[
        "The allottee is advised to inspect the plot and its demarcation carefully before signing this letter; once possession is acknowledged, further claims regarding the visible condition or demarcation of the plot (other than discrepancies reported within the window stated above) may not be entertained.",
        "From the date of possession, all risk, security, and day-to-day upkeep of the plot becomes the allottee's responsibility, without prejudice to the Company's obligations under the Sale Agreement regarding title transfer.",
        "Any dispute regarding the particulars stated in this letter must be raised in writing within 7 (seven) days of receipt; the Company's record shall otherwise be treated as final and binding."]},
      {"key":"acknowledgement","heading":"ACKNOWLEDGEMENT","style":"paragraphs","items":[
        "I / We hereby acknowledge that I / We have inspected the above plot, accept physical possession in \"as-is\" condition, and have read and understood the Terms of Handover and Clarifications stated above. We thank you for choosing SIMCO Developers and look forward to a continued relationship."]}
    ]$json$),
    ------------------------------------------------------------------ NDC
    ('ndc_letter', 'NO DUES CERTIFICATE', 'NDC', $json$[
      {"key":"intro","heading":"","style":"paragraphs","items":[
        "This is to certify that the below-named allottee has cleared all payments due against the plot described below, in accordance with the Sale Agreement and Installment Payment Schedule executed between the parties."]},
      {"key":"certification","heading":"CERTIFICATION","style":"bullets","items":[
        "As of the date of this certificate, no outstanding dues, installments, penalties, surcharges, or other charges remain payable by the allottee against the above plot, based on the Company's financial records as of the date stated above.",
        "This certificate is issued solely to confirm clearance of financial dues and does not, by itself, constitute transfer of title, conveyance, or possession of the plot; these remain subject to the separate processes set out in the Sale Agreement.",
        "This NDC is issued at the allottee's request for {{ndc_purpose}}."]},
      {"key":"clarifications","heading":"IMPORTANT CLARIFICATIONS","style":"bullets","items":[
        "This certificate is valid only for the specific purpose stated above and only as of the date of issuance; it does not cover, and shall not be construed as clearance for, any dues, charges, or maintenance costs that become payable after this date.",
        "Issuance of this certificate does not waive or affect any other right, obligation, or condition set out in the Sale Agreement, including but not limited to obligations relating to transfer charges, documentation costs, and applicable taxes at the time of title transfer.",
        "This certificate is subject to verification by the Company's Finance / Accounts department and may be revised or withdrawn if a discrepancy in Company records is subsequently identified.",
        "This certificate should be used within 07 (seven) days of issuance for the stated purpose; a fresh NDC may be required if used beyond this period."]}
    ]$json$)
    ) as v(doc_type, title, ref_prefix, sections)
  loop
    perform public.save_document_template(p_project_id, t.doc_type, t.title, t.ref_prefix, t.sections::jsonb,
                                          'Installed SIMCO plot-society template set');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.install_document_templates(uuid, text) from anon, public;
grant execute on function public.install_document_templates(uuid, text) to authenticated;
